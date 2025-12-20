'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useResolutionStream } from '@/hooks/useResolutionStream';

interface LiveResolutionViewerProps {
    marketId: string;
    agentApiUrl?: string;
    wsUrl?: string;
}

export default function LiveResolutionViewer({
    marketId,
    agentApiUrl = 'http://localhost:3001',
    wsUrl = 'ws://localhost:3002'
}: LiveResolutionViewerProps) {
    const {
        logs,
        status,
        countdown,
        decision,
        reasoning,
        scheduleResolution,
        cancelSchedule,
    } = useResolutionStream({ marketId, wsUrl, agentUrl: agentApiUrl });

    const [scheduleMinutes, setScheduleMinutes] = useState(1);
    const [copied, setCopied] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to latest log
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Play sound on key events
    useEffect(() => {
        if (status === 'complete' && decision) {
            // Play resolution complete sound
            try {
                const audio = new Audio('/sounds/resolution-complete.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => { }); // Ignore autoplay errors
            } catch { }
        }
    }, [status, decision]);

    const getSpeakerColor = (speaker: string) => {
        switch (speaker) {
            case 'Researcher': return 'text-blue-400';
            case 'Judge': return 'text-purple-400';
            case 'Executor': return 'text-green-400';
            case 'System': return 'text-yellow-400';
            default: return 'text-gray-400';
        }
    };

    const getSentimentGlow = (sentiment?: string) => {
        switch (sentiment) {
            case 'Positive': return 'border-l-green-500';
            case 'Negative': return 'border-l-red-500';
            default: return 'border-l-gray-600';
        }
    };

    const formatCountdown = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSchedule = async () => {
        await scheduleResolution(scheduleMinutes);
    };

    const shareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/market/${marketId}`
        : '';

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for browsers without clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="glass-panel rounded-xl border border-cyan-500/30 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 p-4 border-b border-cyan-500/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${status === 'streaming' ? 'bg-red-500 animate-pulse' :
                            status === 'connected' ? 'bg-green-500' :
                                status === 'complete' ? 'bg-purple-500' :
                                    'bg-gray-500'
                            }`} />
                        <span className="text-white font-bold">
                            {status === 'streaming' ? '🔴 LIVE Resolution' :
                                countdown !== null ? '⏰ Countdown Active' :
                                    status === 'complete' ? '✅ Resolution Complete' :
                                        '📡 Watching Market'}
                        </span>
                    </div>

                    {/* Share button */}
                    <button
                        onClick={handleShare}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${copied
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                            }`}
                    >
                        {copied ? '✓ Copied!' : '📤 Share Stream'}
                    </button>
                </div>
            </div>

            {/* Countdown or Decision Display */}
            <AnimatePresence mode="wait">
                {countdown !== null && countdown > 0 && (
                    <motion.div
                        key="countdown"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="p-8 text-center bg-gradient-to-b from-black/50 to-transparent"
                    >
                        <div className="text-xs text-gray-400 mb-2">RESOLUTION IN</div>
                        <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 font-mono">
                            {formatCountdown(countdown)}
                        </div>
                        <button
                            onClick={cancelSchedule}
                            className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm hover:bg-red-500/30 transition-colors"
                        >
                            Cancel
                        </button>
                    </motion.div>
                )}

                {status === 'complete' && decision && (
                    <motion.div
                        key="decision"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-8 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className={`text-8xl mb-4 ${decision === 'YES' ? 'drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]' :
                                decision === 'NO' ? 'drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]' :
                                    'drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]'
                                }`}
                        >
                            {decision === 'YES' ? '✅' : decision === 'NO' ? '❌' : '❓'}
                        </motion.div>
                        <div className={`text-4xl font-bold mb-4 ${decision === 'YES' ? 'text-green-400' :
                            decision === 'NO' ? 'text-red-400' :
                                'text-yellow-400'
                            }`}>
                            {decision}
                        </div>
                        {reasoning && (
                            <p className="text-gray-400 text-sm max-w-md mx-auto">
                                {reasoning.substring(0, 200)}...
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Schedule Controls (when no countdown active) */}
            {countdown === null && status !== 'complete' && (
                <div className="p-4 bg-black/30 border-b border-gray-700/50 flex items-center gap-4">
                    <span className="text-gray-400 text-sm">Schedule Resolution:</span>
                    <input
                        type="number"
                        min="1"
                        max="60"
                        value={scheduleMinutes}
                        onChange={(e) => setScheduleMinutes(parseInt(e.target.value) || 1)}
                        className="w-16 bg-black/50 border border-gray-700 rounded px-2 py-1 text-white text-center"
                    />
                    <span className="text-gray-400 text-sm">minutes</span>
                    <button
                        onClick={handleSchedule}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg text-white font-medium hover:from-cyan-400 hover:to-purple-400 transition-colors"
                    >
                        ⏰ Schedule
                    </button>
                </div>
            )}

            {/* Logs Stream */}
            <div className="h-64 overflow-y-auto p-4 space-y-2 font-mono text-sm bg-black/50">
                {logs.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                        Waiting for agent activity...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <motion.div
                            key={`${log.timestamp}-${i}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`border-l-2 pl-3 py-1 ${getSentimentGlow(log.sentiment)}`}
                        >
                            <span className={`font-bold ${getSpeakerColor(log.speaker)}`}>
                                [{log.speaker}]
                            </span>{' '}
                            <span className="text-gray-300">{log.message}</span>
                        </motion.div>
                    ))
                )}
                <div ref={logsEndRef} />
            </div>

            {/* Footer */}
            <div className="p-3 bg-black/30 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
                <span>Market: {marketId}</span>
                <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${status === 'connected' || status === 'streaming' ? 'bg-green-500' : 'bg-gray-500'
                        }`} />
                    {status}
                </span>
            </div>
        </div>
    );
}
