"use client";

import { motion } from "framer-motion";

interface BlinkCardProps {
    marketId: string;
    question: string;
}

export default function BlinkCard({ marketId, question }: BlinkCardProps) {
    const blinkUrl = `https://prophecy.fun/api/actions/bet/${marketId}`; // Mock URL

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

                <div className="bg-black/50 p-3 rounded border border-gray-800 flex items-center justify-between">
                    <code className="text-cyan-400 text-xs truncate mr-2">{blinkUrl}</code>
                    <button
                        onClick={() => navigator.clipboard.writeText(blinkUrl)}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                        COPY
                    </button>
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
