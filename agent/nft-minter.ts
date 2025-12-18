/**
 * NFT Minter Module
 * 
 * Uses Metaplex UMI to mint Proof-Of-Truth NFTs for market resolutions.
 * These NFTs serve as on-chain proof that a user participated in a market.
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
    createNft,
    mplTokenMetadata,
    fetchDigitalAsset
} from '@metaplex-foundation/mpl-token-metadata';
import {
    generateSigner,
    keypairIdentity,
    publicKey as umiPublicKey,
    percentAmount,
    Umi,
    Keypair as UmiKeypair
} from '@metaplex-foundation/umi';
import { createSignerFromKeypair } from '@metaplex-foundation/umi';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';
import { pinNFTMetadata, createProofNFTMetadata } from './ipfs.js';

// Environment configuration
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

/**
 * NFT Mint Result
 */
export interface NFTMintResult {
    success: boolean;
    mintAddress?: string;
    signature?: string;
    metadataUri?: string;
    explorerUrl?: string;
    error?: string;
}

/**
 * NFT Minter class using Metaplex UMI
 */
export class NFTMinter {
    private umi: Umi;
    private initialized: boolean = false;

    constructor(rpcUrl: string = RPC_URL) {
        // Initialize UMI with RPC
        this.umi = createUmi(rpcUrl).use(mplTokenMetadata());
        console.log('🖼️ NFT Minter initialized with RPC:', rpcUrl);
    }

    /**
     * Initialize the minter with a keypair for signing transactions
     */
    async initialize(keypairPath?: string): Promise<boolean> {
        try {
            let keypair: Keypair;
            const defaultKeypairPath = './nft-minter-keypair.json';

            // Try to load existing keypair or create new one
            const pathToUse = keypairPath || defaultKeypairPath;

            if (fs.existsSync(pathToUse)) {
                // Load keypair from file
                const secretKey = JSON.parse(fs.readFileSync(pathToUse, 'utf-8'));
                keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
                console.log('🔑 Loaded keypair from file:', keypair.publicKey.toBase58());
            } else {
                // Generate a new keypair and save it
                keypair = Keypair.generate();
                console.log('🔑 Generated new keypair:', keypair.publicKey.toBase58());

                // Save keypair for future use
                fs.writeFileSync(pathToUse, JSON.stringify(Array.from(keypair.secretKey)));
                console.log('💾 Saved keypair to:', pathToUse);
            }

            // Convert Solana Keypair to UMI Keypair
            const umiKeypair: UmiKeypair = {
                publicKey: umiPublicKey(keypair.publicKey.toBase58()),
                secretKey: keypair.secretKey
            };

            // Create signer from keypair
            const signer = createSignerFromKeypair(this.umi, umiKeypair);
            this.umi = this.umi.use(keypairIdentity(signer));

            // Check balance and airdrop if needed (devnet only)
            await this.ensureFunded(keypair.publicKey.toBase58());

            this.initialized = true;
            console.log('✅ NFT Minter fully initialized');
            return true;
        } catch (error: any) {
            console.error('❌ Failed to initialize NFT Minter:', error.message);
            return false;
        }
    }

    /**
     * Ensure the minter wallet has enough SOL for transactions
     */
    private async ensureFunded(publicKey: string): Promise<void> {
        try {
            const { Connection, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
            const connection = new Connection(RPC_URL, 'confirmed');

            let balance = await connection.getBalance(new PublicKey(publicKey));
            let solBalance = balance / LAMPORTS_PER_SOL;
            console.log(`💰 Wallet balance: ${solBalance.toFixed(4)} SOL`);

            // If balance is too low and we're on devnet, request airdrop
            if (solBalance < 0.05 && (RPC_URL.includes('devnet') || RPC_URL.includes('api.devnet'))) {
                console.log('⏳ Requesting devnet airdrop...');
                try {
                    // Use public devnet for airdrop
                    const devnetConnection = new Connection('https://api.devnet.solana.com', 'confirmed');
                    const signature = await devnetConnection.requestAirdrop(
                        new PublicKey(publicKey),
                        LAMPORTS_PER_SOL // 1 SOL
                    );

                    // Wait for confirmation
                    await devnetConnection.confirmTransaction(signature, 'finalized');
                    console.log('✅ Airdrop successful! +1 SOL');

                    // Wait for RPC propagation
                    console.log('⏳ Waiting for balance to propagate...');
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // Verify balance
                    balance = await connection.getBalance(new PublicKey(publicKey));
                    solBalance = balance / LAMPORTS_PER_SOL;
                    console.log(`💰 Updated balance: ${solBalance.toFixed(4)} SOL`);

                } catch (airdropError: any) {
                    console.log('⚠️ Airdrop failed (rate limited?):', airdropError.message);
                    console.log('   You can manually fund with: solana airdrop 1 ' + publicKey + ' --url devnet');
                }
            } else if (solBalance < 0.05) {
                console.log('⚠️ Low balance! Please fund the wallet for mainnet minting.');
            }
        } catch (error: any) {
            console.log('⚠️ Could not check balance:', error.message);
        }
    }

    /**
     * Mint a Proof-Of-Truth NFT
     */
    async mintProofNFT(
        marketId: string,
        question: string,
        outcome: 'YES' | 'NO',
        transcriptCid: string,
        recipientAddress: string
    ): Promise<NFTMintResult> {
        console.log(`\n🖼️ Minting Proof-Of-Truth NFT...`);
        console.log(`   Market: ${marketId}`);
        console.log(`   Outcome: ${outcome}`);
        console.log(`   Recipient: ${recipientAddress}`);

        if (!this.initialized) {
            // Try to initialize without keypair path (will generate new)
            const success = await this.initialize();
            if (!success) {
                return {
                    success: false,
                    error: 'NFT Minter not initialized'
                };
            }
        }

        try {
            // Step 1: Create metadata
            const metadata = createProofNFTMetadata(
                marketId,
                question,
                outcome,
                transcriptCid,
                Date.now()
            );

            // Step 2: Pin metadata to IPFS
            console.log('   📦 Pinning metadata to IPFS...');
            const metadataCid = await pinNFTMetadata(metadata);
            const metadataUri = `https://ipfs.io/ipfs/${metadataCid}`;
            console.log(`   📦 Metadata URI: ${metadataUri}`);

            // Step 3: Generate mint signer
            const mint = generateSigner(this.umi);
            console.log(`   🔑 Mint address: ${mint.publicKey}`);

            // Step 4: Create the NFT
            console.log('   ⛓️ Creating NFT on-chain...');
            const { signature } = await createNft(this.umi, {
                mint,
                name: metadata.name,
                uri: metadataUri,
                sellerFeeBasisPoints: percentAmount(0), // No royalties for proof NFTs
                symbol: 'PROOF',
                creators: [
                    {
                        address: this.umi.identity.publicKey,
                        verified: true,
                        share: 100
                    }
                ],
                isMutable: false, // Proof NFTs should be immutable
            }).sendAndConfirm(this.umi);

            // Convert signature to string
            const signatureStr = bs58.encode(signature);
            const mintAddressStr = mint.publicKey.toString();

            console.log(`   ✅ NFT minted successfully!`);
            console.log(`   📝 Signature: ${signatureStr}`);
            console.log(`   🖼️ Mint Address: ${mintAddressStr}`);

            return {
                success: true,
                mintAddress: mintAddressStr,
                signature: signatureStr,
                metadataUri,
                explorerUrl: `https://explorer.solana.com/address/${mintAddressStr}?cluster=devnet`
            };

        } catch (error: any) {
            console.error(`   ❌ Minting failed:`, error.message);

            // Check for common errors
            if (error.message?.includes('insufficient lamports')) {
                return {
                    success: false,
                    error: 'Insufficient SOL for minting. Please fund the agent wallet.'
                };
            }

            return {
                success: false,
                error: error.message || 'Unknown minting error'
            };
        }
    }

    /**
     * Fetch NFT details by mint address
     */
    async fetchNFT(mintAddress: string): Promise<any> {
        try {
            const asset = await fetchDigitalAsset(
                this.umi,
                umiPublicKey(mintAddress)
            );
            return {
                success: true,
                asset
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Default instance
let defaultMinter: NFTMinter | null = null;

/**
 * Get or create the default NFT minter instance
 */
export function getDefaultMinter(): NFTMinter {
    if (!defaultMinter) {
        defaultMinter = new NFTMinter(RPC_URL);
    }
    return defaultMinter;
}

/**
 * Mint a Proof-Of-Truth NFT (convenience function)
 */
export async function mintProofNFT(
    marketId: string,
    question: string,
    outcome: 'YES' | 'NO',
    transcriptCid: string,
    recipientAddress: string
): Promise<NFTMintResult> {
    const minter = getDefaultMinter();
    return minter.mintProofNFT(marketId, question, outcome, transcriptCid, recipientAddress);
}
