'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

// Program IDs
const PROPHECY_PROGRAM_ID = new PublicKey('UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4');

interface BlinkCreatorProps {
    onMarketCreated?: (marketId: string, blinkUrl: string) => void;
}

export default function BlinkCreator({ onMarketCreated }: BlinkCreatorProps) {
    const [tweetUrl, setTweetUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdMarket, setCreatedMarket] = useState<{
        marketId: string;
        blinkUrl: string;
        dialToUrl?: string;
        question: string;
        signature?: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);
    const [program, setProgram] = useState<Program | null>(null);

    const { publicKey, connected, wallet } = useWallet();
    const { connection } = useConnection();

    // Load Anchor program
    useEffect(() => {
        const loadProgram = async () => {
            if (!wallet || !publicKey) return;

            try {
                // Fetch IDL from the deployed program
                const provider = new AnchorProvider(
                    connection,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    wallet.adapter as any,
                    { commitment: 'confirmed' }
                );

                // Try to fetch IDL from network
                const idl = await Program.fetchIdl(PROPHECY_PROGRAM_ID, provider);
                if (idl) {
                    const prog = new Program(idl, provider);
                    setProgram(prog);
                    console.log('✅ Program loaded');
                }
            } catch (err) {
                console.warn('Could not load program IDL:', err);
            }
        };

        loadProgram();
    }, [wallet, publicKey, connection]);

    // Extract tweet ID from URL
    const extractTweetId = (url: string): string | null => {
        const patterns = [
            /twitter\.com\/\w+\/status\/(\d+)/,
            /x\.com\/\w+\/status\/(\d+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    // Validate tweet URL
    const isValidTweetUrl = (url: string): boolean => {
        return extractTweetId(url) !== null;
    };

    // Generate short market ID (max 32 chars for PDA seed)
    const generateMarketId = (): string => {
        const timestamp = Date.now().toString(36).substring(0, 6);
        const random = Math.random().toString(36).substring(2, 6);
        return `m${timestamp}${random}`; // ~12 chars, well under 32
    };

    // Find Market PDA
    const findMarketPda = (marketId: string): [PublicKey, number] => {
        return PublicKey.findProgramAddressSync(
            [Buffer.from('market'), Buffer.from(marketId)],
            PROPHECY_PROGRAM_ID
        );
    };

    // Find AgentExecutor PDA
    const findAgentExecutorPda = (): [PublicKey, number] => {
        return PublicKey.findProgramAddressSync(
            [Buffer.from('agent_executor')],
            PROPHECY_PROGRAM_ID
        );
    };

    // Create market on-chain
    const handleCreateMarket = useCallback(async () => {
        if (!tweetUrl || !isValidTweetUrl(tweetUrl)) {
            setError('Please enter a valid Twitter/X URL');
            return;
        }

        if (!connected || !publicKey) {
            setError('Please connect your wallet first');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const marketId = generateMarketId();
            const tweetId = extractTweetId(tweetUrl);
            const question = `Will the prediction in tweet ${tweetId} come true?`;

            let signature: string | undefined;

            // Try real on-chain creation if program is loaded
            if (program) {
                try {
                    const [marketPda] = findMarketPda(marketId);
                    const [agentExecutorPda] = findAgentExecutorPda();

                    // Call initialize_market instruction
                    signature = await program.methods
                        .initializeMarket(tweetUrl, marketId, null)
                        .accounts({
                            market: marketPda,
                            agentExecutor: agentExecutorPda,
                            creator: publicKey,
                            systemProgram: SystemProgram.programId,
                        })
                        .rpc();

                    console.log('✅ Market created on-chain:', signature);
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    console.warn('On-chain creation failed, using demo mode:', errorMessage);
                    // Continue with demo mode if on-chain fails
                }
            } else {
                // Demo mode - simulate creation
                console.log('📍 Demo mode: simulating market creation');
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // Generate Blink URLs
            const baseUrl = typeof window !== 'undefined'
                ? window.location.origin
                : 'https://prophecy.fun';
            const blinkUrl = `${baseUrl}/api/actions/bet/${marketId}`;

            // Generate dial.to test URL for Blink preview
            const dialToUrl = `https://dial.to/?action=${encodeURIComponent(blinkUrl)}&cluster=devnet`;

            // Notify agent about new market (optional - for auto-resolution trigger)
            try {
                await fetch('http://localhost:3001/market-created', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        marketId,
                        tweetUrl,
                        creator: publicKey?.toBase58(),
                    }),
                });
                console.log('📡 Agent notified about new market');
            } catch {
                console.log('Agent notification skipped (service may not be running)');
            }

            setCreatedMarket({
                marketId,
                blinkUrl,
                dialToUrl,
                question,
                signature
            });

            onMarketCreated?.(marketId, blinkUrl);

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create market';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tweetUrl, connected, publicKey, program, onMarketCreated]);

    // Copy blink URL
    const handleCopyBlink = useCallback(() => {
        if (createdMarket?.blinkUrl) {
            navigator.clipboard.writeText(createdMarket.blinkUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [createdMarket]);

    // Share on X - shares the Action API URL for Blink unfurling
    const handleShareOnX = useCallback(() => {
        if (createdMarket) {
            // Use the Action API URL for Blink unfurling on X
            // This is the URL that enables the interactive Blink preview
            const shareText = encodeURIComponent(
                `🔮 Make your prediction!\n\n${createdMarket.question}\n\nPowered by @ProphecyDeFAI ⚡`
            );
            // Share the blinkUrl (Action API) for proper unfurling
            const shareUrl = encodeURIComponent(createdMarket.blinkUrl);
            window.open(
                `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
                '_blank'
            );
        }
    }, [createdMarket]);

    // Reset form
    const handleReset = () => {
        setTweetUrl('');
        setCreatedMarket(null);
        setError(null);
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
                {!createdMarket ? (
                    <motion.div
                        key="input"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-4"
                    >
                        {/* Tweet URL Input */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500" />
                            <div className="relative flex items-center glass-panel rounded-xl p-1">
                                <div className="flex items-center pl-4 text-gray-500">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </div>
                                <input
                                    type="url"
                                    value={tweetUrl}
                                    onChange={(e) => {
                                        setTweetUrl(e.target.value);
                                        setError(null);
                                    }}
                                    placeholder="Paste a Tweet/X URL to create a prediction market..."
                                    className="flex-1 bg-transparent text-white p-4 outline-none placeholder-gray-500 text-base"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={handleCreateMarket}
                                    disabled={isLoading || !tweetUrl}
                                    className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 mr-1"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>✨</span>
                                            <span>Create Blink</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error message */}
                        {error && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-red-400 text-sm text-center"
                            >
                                {error}
                            </motion.p>
                        )}

                        {/* Hint & Status */}
                        <div className="text-center space-y-1">
                            <p className="text-gray-500 text-sm">
                                Paste any tweet URL to instantly create a shareable prediction market
                            </p>
                            {program ? (
                                <p className="text-green-400 text-xs">✓ Connected to Solana Devnet</p>
                            ) : connected ? (
                                <p className="text-yellow-400 text-xs">⚠️ Demo mode (program not deployed)</p>
                            ) : (
                                <p className="text-gray-500 text-xs">Connect wallet for on-chain creation</p>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="space-y-6"
                    >
                        {/* Success Card */}
                        <div className="glass-panel rounded-xl p-6 border border-green-500/30 relative overflow-hidden">
                            {/* Animated success glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-cyan-500/10 animate-pulse" />

                            <div className="relative">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <span className="text-2xl">🔮</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Market Created!</h3>
                                        <p className="text-sm text-gray-400">ID: {createdMarket.marketId}</p>
                                    </div>
                                    {createdMarket.signature && (
                                        <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                            On-Chain ✓
                                        </span>
                                    )}
                                </div>

                                <p className="text-gray-300 text-sm mb-4 bg-black/30 p-3 rounded-lg">
                                    {createdMarket.question}
                                </p>

                                {/* Transaction signature */}
                                {createdMarket.signature && (
                                    <div className="mb-4">
                                        <a
                                            href={`https://explorer.solana.com/tx/${createdMarket.signature}?cluster=devnet`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-cyan-400 hover:underline"
                                        >
                                            View transaction on Solana Explorer →
                                        </a>
                                    </div>
                                )}

                                {/* Blink URL */}
                                <div className="bg-black/50 p-3 rounded-lg flex items-center gap-3 mb-2">
                                    <code className="text-cyan-400 text-sm flex-1 truncate font-mono">
                                        {createdMarket.blinkUrl}
                                    </code>
                                    <button
                                        onClick={handleCopyBlink}
                                        className="text-gray-400 hover:text-white transition-colors px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-sm"
                                    >
                                        {copied ? '✓ Copied' : 'Copy'}
                                    </button>
                                </div>

                                {/* Test Blink Preview */}
                                {createdMarket.dialToUrl && (
                                    <div className="mb-4">
                                        <a
                                            href={createdMarket.dialToUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-400 hover:underline flex items-center gap-1"
                                        >
                                            🧪 Test Blink Preview on dial.to →
                                        </a>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Note: Blinks render in Phantom, Backpack, or when shared on X
                                        </p>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleShareOnX}
                                        className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-3 px-4 rounded-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                        </svg>
                                        Share on X
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="px-6 py-3 border border-gray-700 text-gray-300 font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                                    >
                                        Create Another
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <p className="text-xs text-gray-500 text-center">
                            ⚠️ This is a non-monetary forecasting platform. No real money is involved in predictions.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
