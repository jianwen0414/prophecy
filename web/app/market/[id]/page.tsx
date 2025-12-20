'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import type { Wallet } from '@coral-xyz/anchor/dist/cjs/provider';
import BN from 'bn.js';
import ProofNFTModal from '@/components/ProofNFTModal';
import WalletButton from '@/components/WalletButton';
import LiveResolutionViewer from '@/components/LiveResolutionViewer';
import OracleStakeCard from '@/components/OracleStakeCard';

const PROPHECY_PROGRAM_ID = new PublicKey('UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4');

interface MarketPageProps {
    params: Promise<{ id: string }>;
}

interface MarketData {
    id: string;
    question: string;
    tweetUrl: string;
    status: 'open' | 'resolved' | 'disputed';
    outcome?: 'YES' | 'NO';
    totalYesStake: number;
    totalNoStake: number;
    evidenceCount: number;
    createdAt: number;
    resolvedAt?: number;
    transcriptCid?: string;
}

export default function MarketPage({ params }: MarketPageProps) {
    // Unwrap async params using React.use()
    const { id: marketId } = use(params);

    const { publicKey, connected, wallet } = useWallet();
    const { connection } = useConnection();
    const [market, setMarket] = useState<MarketData | null>(null);
    const [loading, setLoading] = useState(true);
    const [staking, setStaking] = useState(false);
    const [showNFTModal, setShowNFTModal] = useState(false);
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [submittingEvidence, setSubmittingEvidence] = useState(false);
    const [program, setProgram] = useState<Program | null>(null);
    const [userVaultBalance, setUserVaultBalance] = useState<number>(0);
    const [needsVault, setNeedsVault] = useState(false);
    const [initializingVault, setInitializingVault] = useState(false);

    // Load Anchor program
    useEffect(() => {
        const loadProgram = async () => {
            if (!wallet || !publicKey) return;

            try {
                const provider = new AnchorProvider(
                    connection,
                    wallet.adapter as Wallet,
                    { commitment: 'confirmed' }
                );

                const idl = await Program.fetchIdl(PROPHECY_PROGRAM_ID, provider);
                if (idl) {
                    setProgram(new Program(idl, provider));
                }
            } catch (err) {
                console.warn('Could not load program:', err);
            }
        };

        loadProgram();
    }, [wallet, publicKey, connection]);

    // Fetch market data from chain
    useEffect(() => {
        const fetchMarket = async () => {
            setLoading(true);

            try {
                if (program) {
                    // Real on-chain fetch
                    const [marketPda] = PublicKey.findProgramAddressSync(
                        [Buffer.from('market'), Buffer.from(marketId)],
                        PROPHECY_PROGRAM_ID
                    );

                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const marketAccount = await (program.account as any).market.fetch(marketPda);

                        const statusMap: Record<string, 'open' | 'resolved' | 'disputed'> = {
                            'open': 'open',
                            'resolved': 'resolved',
                            'disputed': 'disputed'
                        };

                        const statusKey = Object.keys(marketAccount.status)[0];

                        setMarket({
                            id: marketId,
                            question: `Prediction for: ${marketAccount.tweetUrl.substring(0, 50)}...`,
                            tweetUrl: marketAccount.tweetUrl,
                            status: statusMap[statusKey] || 'open',
                            outcome: marketAccount.outcome === 1 ? 'YES' : marketAccount.outcome === 0 ? 'NO' : undefined,
                            totalYesStake: marketAccount.totalYesStake.toNumber() / 1_000_000,
                            totalNoStake: marketAccount.totalNoStake.toNumber() / 1_000_000,
                            evidenceCount: marketAccount.evidenceCount,
                            createdAt: marketAccount.createdAt.toNumber() * 1000,
                            resolvedAt: statusKey === 'resolved' ? Date.now() : undefined,
                            transcriptCid: marketAccount.ipfsTranscriptHash.some((b: number) => b !== 0)
                                ? Buffer.from(marketAccount.ipfsTranscriptHash).toString('hex')
                                : undefined,
                        });
                        setLoading(false);
                        return;
                    } catch {
                        console.log('Market not found on-chain, showing placeholder');
                    }
                }

                // Fallback: Show market ID info if not found on chain
                setMarket({
                    id: marketId,
                    question: `Market: ${marketId}`,
                    tweetUrl: '',
                    status: 'open',
                    totalYesStake: 0,
                    totalNoStake: 0,
                    evidenceCount: 0,
                    createdAt: Date.now(),
                });
            } catch (err) {
                console.error('Error fetching market:', err);
            }

            setLoading(false);
        };

        fetchMarket();
    }, [marketId, program]);

    // Fetch user vault balance
    useEffect(() => {
        const fetchVault = async () => {
            if (!program || !publicKey) return;

            try {
                const [vaultPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('reputation_vault'), publicKey.toBuffer()],
                    PROPHECY_PROGRAM_ID
                );

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const vault = await (program.account as any).reputationVault.fetch(vaultPda);
                setUserVaultBalance(vault.credBalance.toNumber() / 1_000_000);
                setNeedsVault(false);
            } catch {
                // Vault doesn't exist yet - user needs to initialize
                setUserVaultBalance(0);
                setNeedsVault(true);
            }
        };

        fetchVault();
    }, [program, publicKey]);

    // Initialize user's ReputationVault (grants 100 Cred)
    const handleInitializeVault = useCallback(async () => {
        if (!connected || !publicKey || !program) {
            alert('Please connect your wallet first');
            return;
        }

        setInitializingVault(true);
        try {
            const [vaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('reputation_vault'), publicKey.toBuffer()],
                PROPHECY_PROGRAM_ID
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tx = await (program.methods as any)
                .initializeReputationVault()
                .accounts({
                    reputationVault: vaultPda,
                    owner: publicKey,
                    payer: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('Vault initialized:', tx);
            alert('🎉 Success! You now have 100 Cred to stake!');
            setUserVaultBalance(100);
            setNeedsVault(false);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to initialize vault:', err);
            alert(`Failed to initialize vault: ${errorMessage}`);
        } finally {
            setInitializingVault(false);
        }
    }, [connected, publicKey, program]);

    // Real on-chain staking
    const handleStake = useCallback(async (direction: 'yes' | 'no') => {
        if (!connected || !publicKey || !program) {
            alert('Please connect your wallet first');
            return;
        }

        if (userVaultBalance < 50) {
            alert(`Insufficient Cred. You have ${userVaultBalance} Cred, need 50.`);
            return;
        }

        setStaking(true);
        try {
            const [marketPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('market'), Buffer.from(marketId)],
                PROPHECY_PROGRAM_ID
            );

            const [vaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('reputation_vault'), publicKey.toBuffer()],
                PROPHECY_PROGRAM_ID
            );

            const [credStakePda] = PublicKey.findProgramAddressSync(
                [Buffer.from('cred_stake'), marketPda.toBuffer(), publicKey.toBuffer()],
                PROPHECY_PROGRAM_ID
            );

            const stakeAmount = new BN(50 * 1_000_000); // 50 Cred

            const tx = await program.methods
                .stakeCred(direction === 'yes', stakeAmount)
                .accounts({
                    market: marketPda,
                    reputationVault: vaultPda,
                    credStake: credStakePda,
                    user: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            alert(`✅ Staked 50 Cred on ${direction.toUpperCase()}!\nTx: ${tx}`);

            // Refresh user balance
            setUserVaultBalance(prev => prev - 50);

            // Refresh market totals
            if (market) {
                setMarket(prev => prev ? {
                    ...prev,
                    totalYesStake: direction === 'yes' ? prev.totalYesStake + 50 : prev.totalYesStake,
                    totalNoStake: direction === 'no' ? prev.totalNoStake + 50 : prev.totalNoStake,
                } : null);
            }

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Staking failed:', err);
            alert(`Staking failed: ${errorMessage}`);
        } finally {
            setStaking(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, publicKey, program, marketId, userVaultBalance]);

    const handleSubmitEvidence = async () => {
        if (!evidenceFile || !connected) return;

        setSubmittingEvidence(true);
        try {
            const formData = new FormData();
            formData.append('file', evidenceFile);
            formData.append('marketId', marketId);
            formData.append('submitter', publicKey?.toBase58() || '');

            const res = await fetch('/api/evidence', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                alert(`Evidence submitted! CID: ${data.cid}`);
                setEvidenceFile(null);
            }
        } catch (err) {
            console.error('Evidence submission failed:', err);
        } finally {
            setSubmittingEvidence(false);
        }
    };

    // Handle NFT claim
    const handleClaimNFT = async () => {
        if (!connected || !publicKey) {
            alert('Please connect your wallet first');
            return;
        }

        if (market?.status !== 'resolved') {
            alert('Market must be resolved before claiming NFT');
            return;
        }

        try {
            // Call agent to mint NFT
            const agentUrl = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:3001';
            const res = await fetch(`${agentUrl}/mint-nft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId: market.id,
                    walletAddress: publicKey.toBase58(),
                    transcriptCid: market.transcriptCid,
                    question: market.question,
                }),
            });

            const data = await res.json();
            if (data.success) {
                // Show success with explorer link
                const message = `🎉 NFT Minted Successfully!\n\nMint Address: ${data.mintAddress}\n\nView on Solana Explorer:\n${data.explorerUrl}`;
                alert(message);

                // Open explorer in new tab
                if (data.explorerUrl) {
                    window.open(data.explorerUrl, '_blank');
                }
            } else {
                alert(`NFT Minting Failed: ${data.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('NFT claim failed:', err);
            alert('Failed to connect to agent. Make sure the agent is running.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl animate-pulse mb-4">🔮</div>
                    <p className="text-gray-400">Loading market...</p>
                </div>
            </div>
        );
    }

    if (!market) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-4">❌</div>
                    <p className="text-gray-400">Market not found</p>
                </div>
            </div>
        );
    }

    const totalStake = market.totalYesStake + market.totalNoStake;
    const yesPercentage = totalStake > 0 ? (market.totalYesStake / totalStake) * 100 : 50;

    return (
        <main className="min-h-screen relative overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-900/20 rounded-full blur-[100px]" />
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/50 border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-2xl">🔮</span>
                        <span className="font-bold text-xl text-white">Prophecy</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        {connected && (
                            <>
                                {needsVault ? (
                                    <button
                                        onClick={handleInitializeVault}
                                        disabled={initializingVault}
                                        className="text-sm bg-gradient-to-r from-green-500 to-cyan-500 text-white px-3 py-1 rounded-lg hover:scale-105 transition-transform disabled:opacity-50"
                                    >
                                        {initializingVault ? '⏳ Claiming...' : '🎁 Claim 100 Cred'}
                                    </button>
                                ) : userVaultBalance < 50 ? (
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('http://localhost:3001/faucet', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ walletAddress: publicKey?.toBase58() }),
                                                });
                                                const data = await res.json();
                                                alert(data.message);
                                                if (data.success) {
                                                    setUserVaultBalance(prev => prev + 100);
                                                }
                                            } catch {
                                                alert('Faucet unavailable. Try again later.');
                                            }
                                        }}
                                        className="text-sm bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-lg hover:scale-105 transition-transform"
                                    >
                                        💰 Get 100 Cred
                                    </button>
                                ) : (
                                    <span className="text-sm text-cyan-400">
                                        {userVaultBalance.toFixed(0)} Cred
                                    </span>
                                )}
                            </>
                        )}
                        <WalletButton />
                    </div>
                </div>
            </nav>

            <div className="z-10 relative max-w-4xl mx-auto px-4 pt-24 pb-12">
                {/* Market Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel rounded-xl p-6 mb-8"
                >
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${market.status === 'open'
                                    ? 'bg-green-500/20 text-green-400'
                                    : market.status === 'resolved'
                                        ? 'bg-purple-500/20 text-purple-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                    {market.status.toUpperCase()}
                                </span>
                                <span className="text-xs text-gray-500">
                                    ID: {market.id}
                                </span>
                                {program && (
                                    <span className="text-xs text-green-400">● On-Chain</span>
                                )}
                                <button
                                    onClick={() => window.location.reload()}
                                    className="text-xs text-gray-400 hover:text-cyan-400 transition-colors ml-2"
                                    title="Refresh market data"
                                >
                                    🔄 Refresh
                                </button>
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">
                                {market.question}
                            </h1>
                            {market.tweetUrl && (
                                <a
                                    href={market.tweetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-cyan-400 hover:underline"
                                >
                                    View original tweet →
                                </a>
                            )}
                        </div>

                        {market.status === 'resolved' && (
                            <button
                                onClick={() => setShowNFTModal(true)}
                                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-semibold text-sm hover:scale-105 transition-transform"
                            >
                                🏆 View Proof NFT
                            </button>
                        )}
                    </div>

                    {/* Stake Distribution */}
                    <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-green-400">YES: {market.totalYesStake.toFixed(1)} Cred</span>
                            <span className="text-red-400">NO: {market.totalNoStake.toFixed(1)} Cred</span>
                        </div>
                        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-green-400"
                                style={{ width: `${yesPercentage}%` }}
                            />
                        </div>
                    </div>

                    {/* Resolution Result Banner */}
                    {market.status === 'resolved' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`mb-6 p-6 rounded-xl border-2 ${market.outcome === 'YES'
                                ? 'bg-gradient-to-r from-green-900/50 to-emerald-900/30 border-green-500/50'
                                : 'bg-gradient-to-r from-red-900/50 to-rose-900/30 border-red-500/50'
                                }`}
                        >
                            <div className="text-center">
                                <div className="text-6xl mb-3">
                                    {market.outcome === 'YES' ? '✅' : '❌'}
                                </div>
                                <h2 className={`text-3xl font-bold mb-2 ${market.outcome === 'YES' ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                    VERDICT: {market.outcome}
                                </h2>
                                <p className="text-gray-300 mb-4">
                                    The AI Council has reached a decision on this prediction.
                                </p>
                                <div className="flex justify-center gap-6 text-sm">
                                    <div className="text-center">
                                        <div className="text-gray-500">Total YES Stakes</div>
                                        <div className="text-green-400 font-bold">{market.totalYesStake.toFixed(1)} Cred</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-gray-500">Total NO Stakes</div>
                                        <div className="text-red-400 font-bold">{market.totalNoStake.toFixed(1)} Cred</div>
                                    </div>
                                    {market.resolvedAt && (
                                        <div className="text-center">
                                            <div className="text-gray-500">Resolved</div>
                                            <div className="text-purple-400 font-bold">
                                                {new Date(market.resolvedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {market.transcriptCid && (
                                    <a
                                        href={`https://ipfs.io/ipfs/${market.transcriptCid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-4 inline-block text-cyan-400 hover:text-cyan-300 text-sm"
                                    >
                                        📜 View AI Transcript on IPFS
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Stake Buttons */}
                    {market.status === 'open' && (
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleStake('yes')}
                                disabled={staking || !connected}
                                className="flex-1 py-4 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {staking ? '⌛ Staking...' : '✅ Signal YES (50 Cred)'}
                            </button>
                            <button
                                onClick={() => handleStake('no')}
                                disabled={staking || !connected}
                                className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {staking ? '⌛ Staking...' : '❌ Signal NO (50 Cred)'}
                            </button>
                        </div>
                    )}
                </motion.div>

                {/* Evidence Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-panel rounded-xl p-6 mb-8"
                >
                    <h2 className="text-lg font-bold text-white mb-4">
                        📎 Evidence ({market.evidenceCount})
                    </h2>

                    {/* Evidence upload */}
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center mb-4">
                        <input
                            type="file"
                            id="evidence-upload"
                            className="hidden"
                            onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                            accept="image/*,.pdf,.txt"
                        />
                        <label
                            htmlFor="evidence-upload"
                            className="cursor-pointer"
                        >
                            {evidenceFile ? (
                                <div className="text-green-400">
                                    <p className="font-medium">{evidenceFile.name}</p>
                                    <p className="text-xs text-gray-500">{(evidenceFile.size / 1024).toFixed(1)} KB</p>
                                </div>
                            ) : (
                                <div className="text-gray-400">
                                    <p className="text-2xl mb-2">📁</p>
                                    <p>Click to upload evidence</p>
                                    <p className="text-xs text-gray-500">Images, PDFs, or text files</p>
                                </div>
                            )}
                        </label>
                    </div>

                    {evidenceFile && (
                        <button
                            onClick={handleSubmitEvidence}
                            disabled={submittingEvidence || !connected}
                            className="w-full py-3 bg-cyan-500 text-white font-bold rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50"
                        >
                            {submittingEvidence ? 'Uploading to IPFS...' : 'Submit Evidence'}
                        </button>
                    )}
                </motion.div>

                {/* Oracle Stakes - Bet on AI accuracy */}
                {market.status === 'open' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 }}
                        className="mb-8"
                    >
                        <OracleStakeCard
                            marketId={marketId}
                            marketPda={PublicKey.findProgramAddressSync(
                                [Buffer.from('market'), Buffer.from(marketId)],
                                PROPHECY_PROGRAM_ID
                            )[0].toBase58()}
                        />
                    </motion.div>
                )}

                {/* Live Resolution Stream */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-8"
                >
                    <h2 className="text-lg font-bold text-white mb-4 text-center">
                        📡 Live Resolution Stream
                    </h2>
                    <LiveResolutionViewer marketId={marketId} />
                </motion.div>
            </div>

            {/* Proof NFT Modal */}
            <ProofNFTModal
                isOpen={showNFTModal}
                onClose={() => setShowNFTModal(false)}
                market={{
                    id: market.id,
                    question: market.question,
                    outcome: market.outcome || 'YES',
                    resolvedAt: market.resolvedAt || Date.now(),
                }}
                nftMetadata={market.transcriptCid ? {
                    name: `Proof-Of-Truth: ${market.id.substring(0, 8)}`,
                    transcriptCid: market.transcriptCid,
                    metadataCid: market.transcriptCid,
                } : undefined}
                userEligible={connected && market.status === 'resolved'}
                onClaim={handleClaimNFT}
            />
        </main>
    );
}
