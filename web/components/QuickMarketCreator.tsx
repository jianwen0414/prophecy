'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface QuickMarketCreatorProps {
    agentApiUrl?: string;
}

export default function QuickMarketCreator({
    agentApiUrl = 'http://localhost:3001'
}: QuickMarketCreatorProps) {
    const [tweetUrl, setTweetUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        marketId?: string;
        blinkUrl?: string;
        shareableBlinkUrl?: string;
        shareLinks?: {
            twitter: string;
            telegram: string;
        };
        error?: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    const isValidTweetUrl = (url: string) => {
        return /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url);
    };

    const handleCreate = async () => {
        if (!tweetUrl || !isValidTweetUrl(tweetUrl)) {
            setResult({ success: false, error: 'Please enter a valid tweet URL' });
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const response = await fetch(`${agentApiUrl}/quick-market`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tweetUrl }),
            });

            const data = await response.json();
            setResult(data);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setResult({ success: false, error: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="glass-panel rounded-xl p-6 border border-purple-500/30">
            <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">⚡</span>
                <h3 className="text-xl font-bold text-white">Quick Market Creator</h3>
                <span className="text-xs bg-gradient-to-r from-cyan-500 to-purple-500 px-2 py-0.5 rounded-full text-white">
                    One-Tap
                </span>
            </div>

            <p className="text-gray-400 text-sm mb-4">
                Paste any tweet URL to instantly create a prediction market and get a shareable Blink!
            </p>

            <div className="space-y-4">
                {/* Input */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={tweetUrl}
                        onChange={(e) => setTweetUrl(e.target.value)}
                        placeholder="https://x.com/user/status/123..."
                        className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
                    />
                    <button
                        onClick={handleCreate}
                        disabled={isLoading || !tweetUrl}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-400 hover:to-purple-400 transition-all"
                    >
                        {isLoading ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            '🚀 Create'
                        )}
                    </button>
                </div>

                {/* Result */}
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg ${result.success ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}
                    >
                        {result.success ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-400">✅</span>
                                    <span className="text-white font-medium">Market Created!</span>
                                </div>

                                <div className="text-xs text-gray-400">
                                    Market ID: <code className="text-purple-400">{result.marketId}</code>
                                </div>

                                {/* Blink URL */}
                                <div className="bg-black/50 rounded-lg p-3">
                                    <div className="text-xs text-gray-400 mb-1">Shareable Blink URL:</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={result.shareableBlinkUrl || ''}
                                            className="flex-1 bg-transparent text-cyan-400 text-sm truncate"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(result.shareableBlinkUrl || '')}
                                            className="px-3 py-1 bg-purple-500/20 rounded text-purple-400 text-xs hover:bg-purple-500/30 transition-colors"
                                        >
                                            {copied ? '✓ Copied' : '📋 Copy'}
                                        </button>
                                    </div>
                                </div>

                                {/* Share Buttons */}
                                <div className="flex gap-2">
                                    <a
                                        href={result.shareLinks?.twitter}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 px-4 py-2 bg-[#1DA1F2]/20 border border-[#1DA1F2]/30 rounded-lg text-center text-[#1DA1F2] hover:bg-[#1DA1F2]/30 transition-colors"
                                    >
                                        𝕏 Share on Twitter
                                    </a>
                                    <a
                                        href={result.shareLinks?.telegram}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 px-4 py-2 bg-[#0088cc]/20 border border-[#0088cc]/30 rounded-lg text-center text-[#0088cc] hover:bg-[#0088cc]/30 transition-colors"
                                    >
                                        📤 Share on Telegram
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-red-400">
                                <span>❌</span>
                                <span>{result.error}</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
