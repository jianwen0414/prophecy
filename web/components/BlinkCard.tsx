"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface BlinkCardProps {
    marketId: string;
    question: string;
}

export default function BlinkCard({ marketId, question }: BlinkCardProps) {
    const blinkUrl = `https://prophecy.fun/api/actions/bet/${marketId}`;
    const dialToUrl = `https://dial.to/?action=${encodeURIComponent(blinkUrl)}&cluster=devnet`;

    const [copiedDialTo, setCopiedDialTo] = useState(false);
    const [copiedRaw, setCopiedRaw] = useState(false);

    const handleCopyDialTo = () => {
        navigator.clipboard.writeText(dialToUrl);
        setCopiedDialTo(true);
        setTimeout(() => setCopiedDialTo(false), 2000);
    };

    const handleCopyRaw = () => {
        navigator.clipboard.writeText(blinkUrl);
        setCopiedRaw(true);
        setTimeout(() => setCopiedRaw(false), 2000);
    };

    return (
        <motion.div
            className="mt-16 w-full max-w-md mx-auto"
            initial={{ opacity: 0, rotateX: 90 }}
            animate={{ opacity: 1, rotateX: 0 }}
            transition={{ type: "spring", bounce: 0.4 }}
        >
            <div className="glass-panel rounded-xl p-6 neon-border relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-purple-500"></div>

                <h3 className="text-xl font-bold text-white mb-2">Market Created</h3>
                <p className="text-gray-400 mb-4 text-sm">{question}</p>

                {/* dial.to Shareable URL (Primary) */}
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-green-400 font-semibold">
                            ✨ Share on X
                        </span>
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                            dial.to
                        </span>
                    </div>
                    <div className="bg-black/50 p-2 rounded border border-green-500/30 flex items-center justify-between">
                        <code className="text-green-400 text-xs truncate mr-2">{dialToUrl}</code>
                        <button
                            onClick={handleCopyDialTo}
                            className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 bg-green-800 hover:bg-green-700 rounded"
                        >
                            {copiedDialTo ? '✓' : 'COPY'}
                        </button>
                    </div>
                </div>

                {/* Raw Action URL (Secondary) */}
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">Raw Action URL</span>
                    </div>
                    <div className="bg-black/50 p-2 rounded border border-gray-800 flex items-center justify-between">
                        <code className="text-cyan-400 text-xs truncate mr-2">{blinkUrl}</code>
                        <button
                            onClick={handleCopyRaw}
                            className="text-xs text-gray-400 hover:text-white transition-colors"
                        >
                            {copiedRaw ? '✓' : 'COPY'}
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex justify-center">
                    <div className="text-xs text-purple-400 uppercase tracking-widest animate-pulse">
                        Ready for Blinks
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
