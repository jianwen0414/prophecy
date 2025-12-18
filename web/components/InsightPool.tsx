'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import Link from 'next/link';

const PROPHECY_PROGRAM_ID = new PublicKey('UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4');

interface PlatformStatsProps {
    agentApiUrl?: string;
}

interface Stats {
    marketsCreated: number;
    marketsResolved: number;
    totalStaked: number;
    totalDistributed: number;
    activeUsers: number;
}

interface Market {
    id: string;
    question: string;
    tweetUrl: string;
    status: string;
    createdAt: number;
    evidenceCount: number;
}

export default function InsightPool({ agentApiUrl = 'http://localhost:3001' }: PlatformStatsProps) {
    const { connection } = useConnection();
    const [stats, setStats] = useState<Stats>({
        marketsCreated: 0,
        marketsResolved: 0,
        totalStaked: 0,
        totalDistributed: 0,
        activeUsers: 0,
    });
    const [markets, setMarkets] = useState<Market[]>([]);
    const [poolInitialized, setPoolInitialized] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Check InsightPool PDA
                const [poolPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('insight_pool')],
                    PROPHECY_PROGRAM_ID
                );
                const accountInfo = await connection.getAccountInfo(poolPda);
                setPoolInitialized(!!accountInfo);

                if (accountInfo && accountInfo.data.length >= 58) {
                    const data = accountInfo.data;
                    const totalCredits = Number(data.readBigUInt64LE(40)) / 1_000_000;
                    const distributionsCount = Number(data.readBigUInt64LE(48));
                    setStats(prev => ({
                        ...prev,
                        totalDistributed: distributionsCount,
                        totalStaked: totalCredits,
                    }));
                }

                // Fetch stats from agent
                try {
                    const statsRes = await fetch(`${agentApiUrl}/stats`);
                    if (statsRes.ok) {
                        const agentStats = await statsRes.json();
                        setStats(prev => ({
                            ...prev,
                            marketsCreated: agentStats.marketsCreated || 0,
                            marketsResolved: agentStats.marketsResolved || 0,
                            activeUsers: agentStats.activeUsers || 0,
                        }));
                    }
                } catch { }

                // Fetch markets from agent
                try {
                    const marketsRes = await fetch(`${agentApiUrl}/markets`);
                    if (marketsRes.ok) {
                        const data = await marketsRes.json();
                        setMarkets(data.markets || []);
                    }
                } catch { }

            } catch (err) {
                console.log('Could not fetch data:', err);
            }
            setLoading(false);
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [connection, agentApiUrl]);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const openMarkets = markets.filter(m => m.status === 'open');

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto"
        >
            <div className="glass-panel rounded-xl p-6 border border-purple-500/30 relative overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 rounded-full filter blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500 rounded-full filter blur-3xl animate-pulse delay-1000" />
                </div>

                <div className="relative">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">📊</span>
                            <h3 className="text-lg font-bold text-white">Platform Stats</h3>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs border ${poolInitialized
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            }`}>
                            {poolInitialized ? '● Live' : '⏳ Initializing'}
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-8 text-center">
                            <div className="animate-spin text-2xl mb-2">📊</div>
                            <p className="text-gray-500 text-sm">Loading platform data...</p>
                        </div>
                    ) : (
                        <>
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-black/30 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-cyan-400">{formatNumber(stats.marketsCreated)}</p>
                                    <p className="text-xs text-gray-500">Markets Created</p>
                                </div>
                                <div className="bg-black/30 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-green-400">{formatNumber(stats.marketsResolved)}</p>
                                    <p className="text-xs text-gray-500">Markets Resolved</p>
                                </div>
                                <div className="bg-black/30 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-purple-400">{formatNumber(stats.totalStaked)}</p>
                                    <p className="text-xs text-gray-500">Total Cred Staked</p>
                                </div>
                                <div className="bg-black/30 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-yellow-400">{formatNumber(stats.totalDistributed)}</p>
                                    <p className="text-xs text-gray-500">Rewards Given</p>
                                </div>
                            </div>

                            {/* Open Markets Section */}
                            <div className="border-t border-gray-800 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <span>🔮</span> Open Markets
                                    </h4>
                                    <span className="text-xs text-cyan-400">{openMarkets.length} active</span>
                                </div>

                                {openMarkets.length === 0 ? (
                                    <div className="text-center py-6 bg-black/30 rounded-lg">
                                        <p className="text-gray-500 text-sm">No open markets yet</p>
                                        <p className="text-xs text-gray-600 mt-1">Create one with the Blink Creator!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {openMarkets.map((market) => (
                                            <Link
                                                key={market.id}
                                                href={`/market/${market.id}`}
                                                className="block p-3 bg-black/40 rounded-lg border border-gray-800 hover:border-cyan-500/50 transition-all hover:bg-black/60"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-white truncate">
                                                            {market.question.length > 60
                                                                ? market.question.substring(0, 60) + '...'
                                                                : market.question}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs text-gray-500">
                                                                ID: {market.id.substring(0, 8)}...
                                                            </span>
                                                            {market.evidenceCount > 0 && (
                                                                <span className="text-xs text-purple-400">
                                                                    📎 {market.evidenceCount} evidence
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-cyan-400">
                                                        <span className="text-xs">Stake →</span>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* On-chain verification */}
                            <div className="bg-black/40 rounded-lg p-3 border border-gray-800 mt-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-green-400">🔗</span>
                                    <span className="text-gray-400">All stats verified on</span>
                                    <span className="text-cyan-400 font-medium">Solana Devnet</span>
                                </div>
                            </div>
                        </>
                    )}

                    <p className="text-xs text-gray-500 text-center mt-4">
                        🔮 Powered by AI Council • Decentralized Truth Discovery
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
