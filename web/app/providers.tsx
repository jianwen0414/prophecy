'use client';

import { useMemo, ReactNode } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    // Use devnet for hackathon/testing
    const network = WalletAdapterNetwork.Devnet;

    // Custom RPC endpoint (can be configured via env)
    const endpoint = useMemo(() => {
        const customRpc = process.env.NEXT_PUBLIC_RPC_URL;
        return customRpc || clusterApiUrl(network);
    }, [network]);

    // Initialize wallet adapters
    const wallets = useMemo(() => [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ], []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}

// Export network config for use in other components
export const NETWORK = WalletAdapterNetwork.Devnet;
export const PROPHECY_PROGRAM_ID = 'UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4';
export const NFT_MINTER_PROGRAM_ID = '5XF89XNFqGSWkzYa6AqYtnA4d2WcdNYYABKzsi9UwKfb';
