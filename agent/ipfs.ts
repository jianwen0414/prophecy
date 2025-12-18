/**
 * IPFS Utilities for Prophecy Agent
 * 
 * Handles pinning transcripts and evidence to IPFS via nft.storage
 * 
 * TODO: Replace NFT_STORAGE_KEY placeholder with actual API key from https://nft.storage
 * Get your free API key at: https://nft.storage/manage/
 */

import { NFTStorage, Blob } from 'nft.storage';
import * as crypto from 'crypto';

// Types
export interface TranscriptBundle {
    marketId: string;
    marketPda: string;
    question: string;
    facts: string[];
    decision: string;
    reasoning: string;
    agentLogs: LogEntry[];
    evidence: EvidenceItem[];
    timestamp: number;
    version: string;
}

export interface EvidenceItem {
    url: string;
    description: string;
    submittedBy: string;
    timestamp: number;
}

export interface LogEntry {
    speaker: string;
    message: string;
    timestamp: number;
    sentiment?: string;
}

export interface NFTMetadata {
    name: string;
    description: string;
    image: string;
    external_url: string;
    attributes: {
        trait_type: string;
        value: string | number;
    }[];
    properties: {
        market_id: string;
        outcome: string;
        transcript_cid: string;
        resolution_timestamp: number;
    };
}

/**
 * Get NFTStorage client
 * Returns null if API key is not configured
 * Note: Reads env var lazily to ensure dotenv has loaded
 */
function getClient(): NFTStorage | null {
    const apiKey = process.env.NFT_STORAGE_KEY || '';

    if (!apiKey ||
        apiKey === 'YOUR_NFT_STORAGE_API_KEY_HERE' ||
        apiKey.length < 10) {
        console.warn('⚠️ NFT.storage API key not configured. IPFS pinning disabled.');
        return null;
    }
    console.log('✅ NFT.storage client initialized');
    return new NFTStorage({ token: apiKey });
}

/**
 * Pin a transcript bundle to IPFS
 * @param transcript The transcript bundle to pin
 * @returns The IPFS CID or a mock CID if not configured or upload fails
 */
export async function pinTranscript(transcript: TranscriptBundle): Promise<string> {
    const client = getClient();

    // Create JSON blob
    const content = JSON.stringify(transcript, null, 2);
    const blob = new Blob([content], { type: 'application/json' });

    // Helper to create mock CID
    const createMockCid = () => {
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        return `bafkreig${hash.substring(0, 50)}`;
    };

    if (!client) {
        // Return a mock CID based on content hash for testing
        const mockCid = createMockCid();
        console.log(`📦 [MOCK] Transcript pinned: ${mockCid}`);
        return mockCid;
    }

    try {
        const cid = await client.storeBlob(blob);
        console.log(`📦 Transcript pinned to IPFS: ${cid}`);
        return cid;
    } catch (error) {
        // Fallback to mock CID if upload fails (e.g., API key expired)
        console.error('Failed to pin transcript, using mock CID:', error);
        const mockCid = createMockCid();
        console.log(`📦 [FALLBACK] Using mock CID: ${mockCid}`);
        return mockCid;
    }
}

/**
 * Pin evidence to IPFS
 * @param evidence The evidence item to pin
 * @returns The IPFS CID
 */
export async function pinEvidence(evidence: EvidenceItem): Promise<string> {
    const client = getClient();

    const content = JSON.stringify(evidence, null, 2);
    const blob = new Blob([content], { type: 'application/json' });

    if (!client) {
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const mockCid = `bafkreie${hash.substring(0, 50)}`;
        console.log(`📎 [MOCK] Evidence pinned: ${mockCid}`);
        return mockCid;
    }

    try {
        const cid = await client.storeBlob(blob);
        console.log(`📎 Evidence pinned to IPFS: ${cid}`);
        return cid;
    } catch (error) {
        console.error('Failed to pin evidence, using mock CID:', error);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const mockCid = `bafkreie${hash.substring(0, 50)}`;
        console.log(`📎 [FALLBACK] Using mock CID: ${mockCid}`);
        return mockCid;
    }
}

/**
 * Create and pin NFT metadata
 * @param metadata The NFT metadata object
 * @returns The IPFS CID for the metadata
 */
export async function pinNFTMetadata(metadata: NFTMetadata): Promise<string> {
    const client = getClient();

    const content = JSON.stringify(metadata, null, 2);
    const blob = new Blob([content], { type: 'application/json' });

    if (!client) {
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const mockCid = `bafkreim${hash.substring(0, 50)}`;
        console.log(`🖼️ [MOCK] NFT metadata pinned: ${mockCid}`);
        return mockCid;
    }

    try {
        const cid = await client.storeBlob(blob);
        console.log(`🖼️ NFT metadata pinned to IPFS: ${cid}`);
        return cid;
    } catch (error) {
        console.error('Failed to pin NFT metadata, using mock CID:', error);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const mockCid = `bafkreim${hash.substring(0, 50)}`;
        console.log(`🖼️ [FALLBACK] Using mock CID: ${mockCid}`);
        return mockCid;
    }
}

/**
 * Convert an IPFS CID to a 32-byte hash for on-chain storage
 * @param cid The IPFS CID string
 * @returns A 32-byte Uint8Array
 */
export function cidToBytes32(cid: string): Uint8Array {
    // Create a SHA256 hash of the CID string
    const hash = crypto.createHash('sha256').update(cid).digest();
    return new Uint8Array(hash);
}

/**
 * Get the full IPFS gateway URL for a CID
 * @param cid The IPFS CID
 * @returns The gateway URL
 */
export function getIPFSUrl(cid: string): string {
    return `https://ipfs.io/ipfs/${cid}`;
}

/**
 * Get the nft.storage gateway URL for a CID
 * @param cid The IPFS CID
 * @returns The nft.storage gateway URL
 */
export function getNFTStorageUrl(cid: string): string {
    return `https://${cid}.ipfs.nftstorage.link`;
}

/**
 * Create NFT metadata for a Proof-Of-Truth NFT
 */
export function createProofNFTMetadata(
    marketId: string,
    question: string,
    outcome: 'YES' | 'NO',
    transcriptCid: string,
    resolutionTimestamp: number
): NFTMetadata {
    return {
        name: `Proof-Of-Truth: ${marketId.substring(0, 8)}`,
        description: `Verified outcome for: "${question}"\n\nThis NFT serves as immutable proof of the AI Council's decision. The complete transcript and evidence are permanently stored on IPFS.\n\n⚠️ This is a collectible with no monetary value. It represents participation in the Prophecy forecasting platform.`,
        image: `https://prophecy.fun/api/nft-image/${marketId}`, // Dynamic image endpoint
        external_url: `https://prophecy.fun/market/${marketId}`,
        attributes: [
            {
                trait_type: 'Outcome',
                value: outcome
            },
            {
                trait_type: 'Resolution Date',
                value: new Date(resolutionTimestamp).toISOString().split('T')[0]
            },
            {
                trait_type: 'Market Type',
                value: 'Prediction'
            },
            {
                trait_type: 'Verification',
                value: 'AI Council Verified'
            }
        ],
        properties: {
            market_id: marketId,
            outcome: outcome,
            transcript_cid: transcriptCid,
            resolution_timestamp: resolutionTimestamp
        }
    };
}
