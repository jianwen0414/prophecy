'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export default function DisclaimerBanner() {
    const [isVisible, setIsVisible] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-0 left-0 right-0 z-40 p-4"
            >
                <div className="max-w-4xl mx-auto">
                    <div className="bg-gray-900/95 backdrop-blur-md rounded-xl border border-yellow-500/30 shadow-lg shadow-yellow-500/10 overflow-hidden">
                        {/* Main banner */}
                        <div className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">⚠️</span>
                                <div>
                                    <p className="text-white font-medium text-sm">
                                        Non-Gambling Forecasting Platform
                                    </p>
                                    <p className="text-gray-400 text-xs">
                                        Prophecy uses reputation tokens only. No real money wagering.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
                                >
                                    {isExpanded ? 'Less' : 'Learn More'}
                                </button>
                                <button
                                    onClick={() => setIsVisible(false)}
                                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-800"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Expanded content */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-4 pb-4 border-t border-gray-800 pt-4">
                                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                                            <div className="bg-black/30 rounded-lg p-3">
                                                <div className="text-green-400 font-medium mb-1">✓ What Prophecy IS</div>
                                                <ul className="text-gray-400 text-xs space-y-1">
                                                    <li>• AI-powered forecasting platform</li>
                                                    <li>• Reputation-based participation</li>
                                                    <li>• Truth verification through AI Council</li>
                                                    <li>• Non-transferable Cred tokens</li>
                                                </ul>
                                            </div>

                                            <div className="bg-black/30 rounded-lg p-3">
                                                <div className="text-red-400 font-medium mb-1">✗ What Prophecy is NOT</div>
                                                <ul className="text-gray-400 text-xs space-y-1">
                                                    <li>• NOT a gambling platform</li>
                                                    <li>• NOT a betting exchange</li>
                                                    <li>• NO real money wagering by users</li>
                                                    <li>• NOT financial investment</li>
                                                </ul>
                                            </div>

                                            <div className="bg-black/30 rounded-lg p-3">
                                                <div className="text-purple-400 font-medium mb-1">🤖 AI Council</div>
                                                <ul className="text-gray-400 text-xs space-y-1">
                                                    <li>• Autonomous resolution</li>
                                                    <li>• Multi-source verification</li>
                                                    <li>• IPFS transcript storage</li>
                                                    <li>• Transparent reasoning</li>
                                                </ul>
                                            </div>
                                        </div>

                                        <p className="text-xs text-gray-500 mt-4 text-center">
                                            Prophecy is designed for forecasting entertainment and truth verification purposes only.
                                            If you have concerns about responsible gaming, please visit
                                            <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline ml-1">
                                                begambleaware.org
                                            </a>
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
