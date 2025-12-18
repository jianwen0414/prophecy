'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ProofNFTModalProps {
    isOpen: boolean;
    onClose: () => void;
    market: {
        id: string;
        question: string;
        outcome: 'YES' | 'NO';
        resolvedAt: number;
    };
    nftMetadata?: {
        name: string;
        image?: string;
        transcriptCid: string;
        metadataCid: string;
    };
    userEligible?: boolean;
    onClaim?: () => void;
}

export default function ProofNFTModal({
    isOpen,
    onClose,
    market,
    nftMetadata,
    userEligible = false,
    onClaim
}: ProofNFTModalProps) {
    const [claiming, setClaiming] = useState(false);
    const [claimed, setClaimed] = useState(false);

    const handleClaim = async () => {
        if (!onClaim) return;
        setClaiming(true);
        try {
            await onClaim();
            setClaimed(true);
        } catch (err) {
            console.error('Claim failed:', err);
        } finally {
            setClaiming(false);
        }
    };

    // Handle escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', bounce: 0.3 }}
                    className="relative w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-2xl blur-lg opacity-50 animate-pulse" />

                    {/* Card */}
                    <div className="relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* NFT Preview */}
                        <div className="relative h-48 bg-gradient-to-br from-purple-900/50 via-pink-900/30 to-cyan-900/50 flex items-center justify-center">
                            <div className="absolute inset-0 overflow-hidden">
                                {/* Animated background */}
                                <div className="absolute inset-0 opacity-30">
                                    <div className="absolute top-0 left-0 w-40 h-40 bg-purple-500 rounded-full filter blur-3xl animate-blob" />
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500 rounded-full filter blur-3xl animate-blob animation-delay-2000" />
                                    <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-cyan-500 rounded-full filter blur-3xl animate-blob animation-delay-4000" />
                                </div>
                            </div>

                            <div className="relative text-center">
                                <div className="text-6xl mb-2">🔮</div>
                                <div className="text-xl font-bold text-white">
                                    PROOF OF TRUTH
                                </div>
                                <div className={`text-sm font-semibold mt-1 ${market.outcome === 'YES' ? 'text-green-400' : 'text-red-400'}`}>
                                    Outcome: {market.outcome}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-white mb-2">
                                {nftMetadata?.name || `Prophecy #${market.id.substring(0, 8)}`}
                            </h3>

                            <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                                {market.question}
                            </p>

                            {/* Metadata */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Resolved</span>
                                    <span className="text-gray-300">
                                        {new Date(market.resolvedAt).toLocaleDateString()}
                                    </span>
                                </div>
                                {nftMetadata?.transcriptCid && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Transcript</span>
                                        <a
                                            href={`https://ipfs.io/ipfs/${nftMetadata.transcriptCid}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-cyan-400 hover:text-cyan-300 transition-colors truncate max-w-[180px]"
                                        >
                                            {nftMetadata.transcriptCid.substring(0, 16)}...
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Claim button */}
                            {userEligible && !claimed ? (
                                <button
                                    onClick={handleClaim}
                                    disabled={claiming}
                                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                                >
                                    {claiming ? (
                                        <>
                                            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Minting...
                                        </>
                                    ) : (
                                        <>
                                            ✨ Claim Your Proof NFT
                                        </>
                                    )}
                                </button>
                            ) : claimed ? (
                                <div className="w-full bg-green-500/20 text-green-400 font-bold py-3 px-6 rounded-xl text-center border border-green-500/30">
                                    ✓ NFT Claimed Successfully
                                </div>
                            ) : (
                                <div className="w-full bg-gray-800 text-gray-400 py-3 px-6 rounded-xl text-center text-sm">
                                    Participate to earn Proof NFTs
                                </div>
                            )}

                            {/* Disclaimer */}
                            <p className="text-xs text-gray-600 text-center mt-4">
                                ⚠️ This NFT is a collectible proof of participation.
                                It carries no monetary value and is not a gambling token.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
