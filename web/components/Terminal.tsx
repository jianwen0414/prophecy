'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LogEntry {
    speaker: 'Researcher' | 'Judge' | 'Executor' | 'System';
    message: string;
    timestamp: number;
    sentiment?: 'Neutral' | 'Positive' | 'Negative';
}

interface WarRoomProps {
    agentApiUrl?: string;
    marketId?: string;
}

export default function WarRoom({ agentApiUrl = 'http://localhost:3001' }: WarRoomProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [theatreMode, setTheatreMode] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [activeNode, setActiveNode] = useState<'researcher' | 'judge' | 'executor' | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Poll for logs
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                // Always use global logs for complete view
                // Market-specific filtering is done by agent fallback
                const endpoint = `${agentApiUrl}/logs`;
                const res = await fetch(endpoint);
                if (res.ok) {
                    const data = await res.json();
                    const logsData = Array.isArray(data) ? data : (data.logs || []);
                    setLogs(logsData);
                    setIsConnected(true);

                    // Determine active node from latest log
                    if (logsData.length > 0) {
                        const latest = logsData[logsData.length - 1];
                        if (latest.speaker === 'Researcher') setActiveNode('researcher');
                        else if (latest.speaker === 'Judge') setActiveNode('judge');
                        else if (latest.speaker === 'Executor') setActiveNode('executor');
                    }
                }
            } catch {
                setIsConnected(false);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 1500);
        return () => clearInterval(interval);
    }, [agentApiUrl]);

    // Auto-scroll
    useEffect(() => {
        if (autoScroll) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    // Handle scroll to detect if user has scrolled up
    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
            const atBottom = scrollHeight - scrollTop - clientHeight < 50;
            setAutoScroll(atBottom);
        }
    }, []);

    // Download transcript
    const handleDownload = useCallback(() => {
        const transcript = logs.map(log =>
            `[${new Date(log.timestamp).toISOString()}] [${log.speaker}] ${log.message}`
        ).join('\n');

        const blob = new Blob([transcript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prophecy-transcript-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }, [logs]);

    // Get speaker color
    const getSpeakerColor = (speaker: string) => {
        switch (speaker) {
            case 'Researcher': return 'text-blue-400';
            case 'Judge': return 'text-purple-400';
            case 'Executor': return 'text-orange-400';
            default: return 'text-green-400';
        }
    };

    // Get sentiment indicator
    const getSentimentIndicator = (sentiment?: string) => {
        if (!sentiment) return null;
        switch (sentiment) {
            case 'Positive': return <span className="text-green-400">●</span>;
            case 'Negative': return <span className="text-red-400">●</span>;
            default: return <span className="text-gray-400">●</span>;
        }
    };

    const baseClasses = theatreMode
        ? 'fixed inset-0 z-50 bg-black'
        : 'w-full max-w-4xl mx-auto mt-12';

    return (
        <motion.div
            className={baseClasses}
            layout
        >
            <div className="h-full p-1 bg-gradient-to-br from-green-500/20 via-purple-500/10 to-cyan-500/20 rounded-lg backdrop-blur-md border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                <div className="bg-black/95 p-4 rounded-lg font-mono text-sm h-full flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4 border-b border-green-500/30 pb-3">
                        <div className="flex items-center gap-4">
                            <div className="flex gap-2">
                                <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                                <span className="w-3 h-3 rounded-full bg-gray-500" />
                            </div>
                            <h3 className="text-green-400 uppercase tracking-widest text-xs font-bold">
                                {`/// WAR ROOM - AI COUNCIL ${isConnected ? 'ACTIVE' : 'OFFLINE'}`}
                            </h3>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Node Status Indicators */}
                            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-900/50 rounded-full">
                                <div className={`flex items-center gap-1 ${activeNode === 'researcher' ? 'opacity-100' : 'opacity-40'}`}>
                                    <span className={`w-2 h-2 rounded-full ${activeNode === 'researcher' ? 'bg-blue-400 animate-pulse' : 'bg-blue-400/50'}`} />
                                    <span className="text-xs text-blue-400">R</span>
                                </div>
                                <div className={`flex items-center gap-1 ${activeNode === 'judge' ? 'opacity-100' : 'opacity-40'}`}>
                                    <span className={`w-2 h-2 rounded-full ${activeNode === 'judge' ? 'bg-purple-400 animate-pulse' : 'bg-purple-400/50'}`} />
                                    <span className="text-xs text-purple-400">J</span>
                                </div>
                                <div className={`flex items-center gap-1 ${activeNode === 'executor' ? 'opacity-100' : 'opacity-40'}`}>
                                    <span className={`w-2 h-2 rounded-full ${activeNode === 'executor' ? 'bg-orange-400 animate-pulse' : 'bg-orange-400/50'}`} />
                                    <span className="text-xs text-orange-400">E</span>
                                </div>
                            </div>

                            {/* Controls */}
                            <button
                                onClick={handleDownload}
                                className="text-xs text-gray-500 hover:text-green-400 transition-colors px-2 py-1 rounded hover:bg-gray-800"
                                title="Download Transcript"
                            >
                                ↓ IPFS
                            </button>
                            <button
                                onClick={() => setTheatreMode(!theatreMode)}
                                className="text-xs text-gray-500 hover:text-green-400 transition-colors px-2 py-1 rounded hover:bg-gray-800"
                            >
                                {theatreMode ? '✕ Exit' : '⛶ Theatre'}
                            </button>
                        </div>
                    </div>

                    {/* Logs Container */}
                    <div
                        ref={containerRef}
                        onScroll={handleScroll}
                        className={`flex-1 overflow-y-auto space-y-2 ${theatreMode ? 'max-h-[calc(100vh-120px)]' : 'max-h-[250px]'}`}
                    >
                        <AnimatePresence>
                            {logs.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-600">
                                    <div className="text-center">
                                        <p className="text-2xl mb-2">🔮</p>
                                        <p>Waiting for agent activity...</p>
                                        <p className="text-xs mt-1">Start the agent server or create a market</p>
                                    </div>
                                </div>
                            ) : (
                                logs.map((log, i) => (
                                    <motion.div
                                        key={`${log.timestamp}-${i}`}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex gap-3 hover:bg-gray-900/50 p-2 rounded transition-colors"
                                    >
                                        <span className="text-gray-600 text-xs mt-0.5 min-w-[70px]">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                {getSentimentIndicator(log.sentiment)}
                                                <span className={`font-bold uppercase text-xs ${getSpeakerColor(log.speaker)}`}>
                                                    {log.speaker}
                                                </span>
                                            </div>
                                            <p className="text-gray-300 text-sm mt-0.5 leading-relaxed">
                                                {log.message}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                        <div ref={bottomRef} />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            {logs.length} events
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setAutoScroll(!autoScroll)}
                                className={`text-xs px-2 py-1 rounded ${autoScroll ? 'text-green-400 bg-green-400/10' : 'text-gray-500'}`}
                            >
                                {autoScroll ? '↓ Following' : '↓ Scroll'}
                            </button>
                        </div>
                    </div>

                    {/* Scan line effect */}
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.02)_50%)] bg-[length:100%_4px] rounded-lg" />
                </div>
            </div>
        </motion.div>
    );
}
