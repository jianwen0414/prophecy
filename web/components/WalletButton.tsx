'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function WalletButton() {
    const { connected, publicKey, disconnect } = useWallet();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="h-10 w-36 bg-gray-800/50 rounded-lg animate-pulse" />
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
        >
            {connected && publicKey && (
                <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-gray-400 font-mono">
                        {publicKey.toBase58().substring(0, 4)}...{publicKey.toBase58().slice(-4)}
                    </span>
                </div>
            )}

            <div className="wallet-adapter-button-custom">
                <WalletMultiButton
                    style={{
                        background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
                        borderRadius: '0.5rem',
                        padding: '0.5rem 1.5rem',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        height: 'auto',
                        boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
                        border: 'none',
                        transition: 'all 0.3s ease',
                    }}
                />
            </div>
        </motion.div>
    );
}
