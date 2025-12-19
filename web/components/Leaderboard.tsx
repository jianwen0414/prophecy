'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

const PROPHECY_PROGRAM_ID = new PublicKey('UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4');
const REPUTATION_VAULT_SEED = Buffer.from('reputation_vault');

interface LeaderboardEntry {
    rank: number;
    address: string;
    displayName?: string;
    credBalance: number;
    accuracy: number;
    predictions: number;
    isYou?: boolean;
}

interface LeaderboardProps {
    entries?: LeaderboardEntry[];
    userAddress?: string;
}

export default function Leaderboard({ entries: propEntries, userAddress }: LeaderboardProps) {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [entries, setEntries] = useState<LeaderboardEntry[]>(propEntries || []);
    const [loading, setLoading] = useState(!propEntries);

    useEffect(() => {
        // If entries are provided as props, use them
        if (propEntries && propEntries.length > 0) {
            setEntries(propEntries);
            setLoading(false);
            return;
        }

        const fetchReputationVaults = async () => {
            try {
                // Query all ReputationVault accounts from the program
                // ReputationVault layout: owner (32) + cred_balance (8) + total_earned (8) +
                //                        total_staked (8) + participation_count (8) + bump (1)
                // Total: 8 (discriminator) + 32 + 8 + 8 + 8 + 8 + 1 = 73 bytes
                const accounts = await connection.getProgramAccounts(PROPHECY_PROGRAM_ID, {
                    filters: [
                        { dataSize: 73 }, // ReputationVault size
                    ],
                });

                if (accounts.length === 0) {
                    setEntries([]);
                    setLoading(false);
                    return;
                }

                // Parse and sort by cred_balance
                const vaults = accounts.map(({ pubkey, account }) => {
                    const data = account.data;
                    // Skip 8-byte discriminator
                    const owner = new PublicKey(data.slice(8, 40));
                    const credBalance = Number(data.readBigUInt64LE(40)) / 1_000_000; // Convert from micro-Cred
                    const totalEarned = Number(data.readBigUInt64LE(48)) / 1_000_000;
                    const totalStaked = Number(data.readBigUInt64LE(56)) / 1_000_000;
                    const participationCount = Number(data.readBigUInt64LE(64));

                    // Calculate accuracy as ratio of earned vs staked (simplified metric)
                    const accuracy = totalStaked > 0
                        ? Math.min(100, Math.round((totalEarned / totalStaked) * 50))
                        : 0;

                    return {
                        pubkey,
                        owner: owner.toBase58(),
                        credBalance,
                        accuracy,
                        predictions: participationCount,
                    };
                });

                // Sort by cred balance (highest first)
                vaults.sort((a, b) => b.credBalance - a.credBalance);

                // Convert to leaderboard entries
                const leaderboardEntries: LeaderboardEntry[] = vaults.slice(0, 20).map((vault, index) => ({
                    rank: index + 1,
                    address: vault.owner.substring(0, 4) + '...' + vault.owner.slice(-4),
                    credBalance: vault.credBalance,
                    accuracy: vault.accuracy,
                    predictions: vault.predictions,
                    isYou: publicKey ? vault.owner === publicKey.toBase58() : false,
                }));

                setEntries(leaderboardEntries);
            } catch (err) {
                console.log('Could not fetch reputation vaults:', err);
                setEntries([]);
            }
            setLoading(false);
        };

        fetchReputationVaults();
        // Refresh every 60 seconds
        const interval = setInterval(fetchReputationVaults, 60000);
        return () => clearInterval(interval);
    }, [propEntries, userAddress, connection, publicKey]);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const getRankColor = (rank: number) => {
        switch (rank) {
            case 1: return 'from-yellow-400 to-amber-600';
            case 2: return 'from-gray-300 to-gray-500';
            case 3: return 'from-amber-600 to-orange-700';
            default: return 'from-gray-700 to-gray-800';
        }
    };

    const getRankEmoji = (rank: number) => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return null;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto"
        >
            <div className="glass-panel rounded-xl overflow-hidden border border-cyan-500/30">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-cyan-900/30 to-purple-900/30">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🏆</span>
                        <div>
                            <h3 className="text-lg font-bold text-white">Cred Leaderboard</h3>
                            <p className="text-xs text-gray-500">Top predictors this season</p>
                        </div>
                    </div>
                    <div className="text-xs text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
                        Live Rankings
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin text-2xl mb-2">🔮</div>
                        <p className="text-gray-500 text-sm">Loading rankings...</p>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="text-4xl mb-4">🌟</div>
                        <h4 className="text-white font-semibold mb-2">Be the First!</h4>
                        <p className="text-gray-500 text-sm">
                            No predictions yet. Make a prediction to appear on the leaderboard!
                        </p>
                        <p className="text-xs text-gray-600 mt-4">
                            Leaderboard updates as users stake Cred on markets.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-2 p-3 text-xs text-gray-500 uppercase border-b border-gray-800 bg-black/30">
                            <div className="col-span-1 text-center">#</div>
                            <div className="col-span-4">Predictor</div>
                            <div className="col-span-3 text-right">Cred</div>
                            <div className="col-span-2 text-right">Accuracy</div>
                            <div className="col-span-2 text-right">Predictions</div>
                        </div>

                        {/* Entries */}
                        <div className="divide-y divide-gray-800/50">
                            {entries.map((entry, index) => (
                                <motion.div
                                    key={entry.address}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`grid grid-cols-12 gap-2 p-3 items-center hover:bg-gray-900/50 transition-colors ${entry.isYou ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : ''
                                        }`}
                                >
                                    {/* Rank */}
                                    <div className="col-span-1 text-center">
                                        {getRankEmoji(entry.rank) || (
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br ${getRankColor(entry.rank)} text-xs font-bold text-white`}>
                                                {entry.rank}
                                            </span>
                                        )}
                                    </div>

                                    {/* Predictor */}
                                    <div className="col-span-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
                                                {(entry.displayName || entry.address)[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">
                                                    {entry.displayName || entry.address}
                                                </p>
                                                {entry.displayName && (
                                                    <p className="text-xs text-gray-500 font-mono">
                                                        {entry.address}
                                                    </p>
                                                )}
                                            </div>
                                            {entry.isYou && (
                                                <span className="text-xs text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Cred Balance */}
                                    <div className="col-span-3 text-right">
                                        <span className="text-sm font-bold text-white">
                                            {formatNumber(entry.credBalance)}
                                        </span>
                                        <span className="text-xs text-gray-500 ml-1">Cred</span>
                                    </div>

                                    {/* Accuracy */}
                                    <div className="col-span-2 text-right">
                                        <span className={`text-sm font-medium ${entry.accuracy >= 90 ? 'text-green-400' :
                                            entry.accuracy >= 80 ? 'text-yellow-400' :
                                                'text-gray-400'
                                            }`}>
                                            {entry.accuracy}%
                                        </span>
                                    </div>

                                    {/* Predictions */}
                                    <div className="col-span-2 text-right">
                                        <span className="text-sm text-gray-400">
                                            {entry.predictions}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </>
                )}

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 text-center">
                    <p className="text-xs text-gray-500">
                        🔒 Cred is non-transferable reputation. Earn by making accurate predictions.
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
