'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

const PROPHECY_PROGRAM_ID = new PublicKey('UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4');
const ORACLE_STAKE_SEED = Buffer.from('oracle_stake');
const REPUTATION_VAULT_SEED = Buffer.from('reputation_vault');

interface OracleStakeCardProps {
    marketId: string;
    marketPda: string;
    agentApiUrl?: string;
}

interface OracleStakeInfo {
    totalStakes: number;
    totalStaked: number;
    claimedCount: number;
    stakes: Array<{
        user: string;
        amount: number;
        timestamp: number;
        claimed: boolean;
    }>;
}

export default function OracleStakeCard({
    marketId,
    marketPda,
    agentApiUrl = 'http://localhost:3001'
}: OracleStakeCardProps) {
    const [amount, setAmount] = useState(50);
    const [isLoading, setIsLoading] = useState(false);
    const [stakeInfo, setStakeInfo] = useState<OracleStakeInfo | null>(null);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const { publicKey, signTransaction, connected } = useWallet();
    const { connection } = useConnection();

    // Fetch oracle stakes for this market
    const fetchStakes = useCallback(async () => {
        try {
            const response = await fetch(`${agentApiUrl}/oracle-stakes/${marketId}`);
            const data = await response.json();
            if (!data.error) {
                setStakeInfo(data);
            }
        } catch (err) {
            console.error('Failed to fetch oracle stakes:', err);
        }
    }, [agentApiUrl, marketId]);

    // Stake on oracle
    const handleStake = async () => {
        if (!connected || !publicKey || !signTransaction) {
            setError('Please connect your wallet first');
            return;
        }

        if (amount < 10) {
            setError('Minimum stake is 10 Cred');
            return;
        }

        setIsLoading(true);
        setError(null);
        setTxSignature(null);

        try {
            // Load IDL dynamically (in production, this should be pre-loaded)
            const idlResponse = await fetch('/prophecy.json');
            if (!idlResponse.ok) {
                throw new Error('IDL not found. Please ensure the IDL is deployed.');
            }
            const idl = await idlResponse.json();

            const provider = new AnchorProvider(
                connection,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { publicKey, signTransaction } as any,
                { commitment: 'confirmed' }
            );

            const program = new Program(idl, provider);

            // Find PDAs
            const marketPubkey = new PublicKey(marketPda);
            const [reputationVaultPda] = PublicKey.findProgramAddressSync(
                [REPUTATION_VAULT_SEED, publicKey.toBuffer()],
                PROPHECY_PROGRAM_ID
            );
            const [oracleStakePda] = PublicKey.findProgramAddressSync(
                [ORACLE_STAKE_SEED, marketPubkey.toBuffer(), publicKey.toBuffer()],
                PROPHECY_PROGRAM_ID
            );

            // Build and send transaction
            const amountBN = BigInt(amount * 1_000_000); // Convert to micro-Cred

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tx = await (program.methods as any)
                .stakeOnOracle(amountBN)
                .accounts({
                    market: marketPubkey,
                    reputationVault: reputationVaultPda,
                    oracleStake: oracleStakePda,
                    user: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            tx.feePayer = publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            const signed = await signTransaction(tx);
            const signature = await connection.sendRawTransaction(signed.serialize());
            await connection.confirmTransaction(signature, 'confirmed');

            setTxSignature(signature);
            fetchStakes(); // Refresh stakes
        } catch (err: unknown) {
            console.error('Oracle stake failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to stake on oracle';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-xl p-4 border border-yellow-500/30"
        >
            <button
                onClick={() => {
                    setIsExpanded(!isExpanded);
                    if (!isExpanded) fetchStakes();
                }}
                className="w-full flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🎯</span>
                    <div className="text-left">
                        <h4 className="text-white font-bold">Trust the Oracle</h4>
                        <p className="text-xs text-gray-400">
                            Bet that the AI resolves this correctly
                        </p>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </motion.div>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-4 mt-4 border-t border-gray-700/50 space-y-4">
                            {/* Stats */}
                            {stakeInfo && (
                                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                    <div className="bg-black/30 rounded-lg p-2">
                                        <div className="text-yellow-400 font-bold">{stakeInfo.totalStakes}</div>
                                        <div className="text-gray-500 text-xs">Stakers</div>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-2">
                                        <div className="text-yellow-400 font-bold">{stakeInfo.totalStaked.toFixed(0)}</div>
                                        <div className="text-gray-500 text-xs">Total Cred</div>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-2">
                                        <div className="text-green-400 font-bold">2x</div>
                                        <div className="text-gray-500 text-xs">Reward</div>
                                    </div>
                                </div>
                            )}

                            {/* Amount slider */}
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-400">Stake Amount</span>
                                    <span className="text-yellow-400 font-bold">{amount} Cred</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="500"
                                    step="10"
                                    value={amount}
                                    onChange={(e) => setAmount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                />
                            </div>

                            {/* Explanation */}
                            <div className="text-xs text-gray-500 bg-black/30 rounded-lg p-3">
                                <p className="mb-1">💡 <strong>How it works:</strong></p>
                                <p>If the market resolves without dispute, you win <span className="text-green-400">2x your stake</span>.</p>
                                <p>If disputed, you lose your stake.</p>
                            </div>

                            {/* Stake button */}
                            <button
                                onClick={handleStake}
                                disabled={isLoading || !connected}
                                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg font-bold text-black disabled:opacity-50 disabled:cursor-not-allowed hover:from-yellow-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Processing...
                                    </>
                                ) : (
                                    <>🎯 Stake {amount} Cred on Oracle</>
                                )}
                            </button>

                            {/* Error/Success messages */}
                            {error && (
                                <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-2">
                                    ❌ {error}
                                </div>
                            )}
                            {txSignature && (
                                <div className="text-green-400 text-sm bg-green-500/10 rounded-lg p-2">
                                    ✅ Staked successfully!{' '}
                                    <a
                                        href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                    >
                                        View transaction
                                    </a>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
