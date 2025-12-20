'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface LogEntry {
    speaker: 'Researcher' | 'Judge' | 'Executor' | 'System';
    message: string;
    timestamp: number;
    sentiment?: 'Neutral' | 'Positive' | 'Negative';
}

interface ScheduledResolution {
    marketId: string;
    scheduledTime: number;
    question: string;
}

interface UseResolutionStreamOptions {
    marketId?: string;
    wsUrl?: string;
    agentUrl?: string;
}

export function useResolutionStream({
    marketId = 'global',
    wsUrl = 'ws://localhost:3002',
    agentUrl = 'http://localhost:3001'
}: UseResolutionStreamOptions = {}) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'streaming' | 'complete' | 'error'>('idle');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [scheduledTime, setScheduledTime] = useState<number | null>(null);
    const [decision, setDecision] = useState<string | null>(null);
    const [reasoning, setReasoning] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setStatus('connecting');

        const ws = new WebSocket(`${wsUrl}?marketId=${marketId}`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('🔌 WebSocket connected');
            setStatus('connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'market_state':
                        if (data.logs) {
                            setLogs(data.logs);
                        }
                        if (data.scheduledResolution) {
                            setScheduledTime(data.scheduledResolution.scheduledTime);
                        }
                        break;

                    case 'log':
                        setLogs(prev => [...prev.slice(-99), data]);
                        setStatus('streaming');
                        break;

                    case 'countdown':
                        setCountdown(data.remainingSeconds);
                        setScheduledTime(data.scheduledTime);
                        break;

                    case 'resolution_started':
                        setStatus('streaming');
                        setCountdown(null);
                        break;

                    case 'resolution_complete':
                        setStatus('complete');
                        setDecision(data.decision);
                        setReasoning(data.reasoning);
                        break;

                    case 'resolution_error':
                        setStatus('error');
                        break;

                    case 'schedule_cancelled':
                        setCountdown(null);
                        setScheduledTime(null);
                        break;
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            setStatus('idle');

            // Attempt to reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setStatus('error');
        };
    }, [marketId, wsUrl]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setStatus('idle');
    }, []);

    const scheduleResolution = useCallback(async (delayMinutes: number = 1) => {
        try {
            const response = await fetch(`${agentUrl}/schedule-resolution/${marketId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delayMinutes }),
            });

            const data = await response.json();
            if (data.success) {
                setScheduledTime(data.scheduledTime);
            }
            return data;
        } catch (err) {
            console.error('Failed to schedule resolution:', err);
            return { success: false, error: err };
        }
    }, [agentUrl, marketId]);

    const cancelSchedule = useCallback(async () => {
        try {
            const response = await fetch(`${agentUrl}/schedule-resolution/${marketId}`, {
                method: 'DELETE',
            });

            const data = await response.json();
            if (data.success) {
                setScheduledTime(null);
                setCountdown(null);
            }
            return data;
        } catch (err) {
            console.error('Failed to cancel schedule:', err);
            return { success: false, error: err };
        }
    }, [agentUrl, marketId]);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return {
        logs,
        status,
        countdown,
        scheduledTime,
        decision,
        reasoning,
        connect,
        disconnect,
        scheduleResolution,
        cancelSchedule,
    };
}
