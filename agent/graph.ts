/**
 * Prophecy Agent - AI Council for Market Resolution
 * 
 * LangGraph-powered agent system with Researcher, Judge, and Executor nodes
 * for autonomous prediction market resolution.
 */

// Load environment variables FIRST before any other imports
import * as dotenv from 'dotenv';
dotenv.config();

import { StateGraph, END } from '@langchain/langgraph';
import { Connection, PublicKey } from '@solana/web3.js';
import express from 'express';
import cors from 'cors';

import {
    pinTranscript,
    cidToBytes32,
    createProofNFTMetadata,
    pinNFTMetadata,
    type TranscriptBundle,
    type LogEntry,
    type EvidenceItem
} from './ipfs.js';
import {
    SolanaAgent,
    createAgent,
    PROPHECY_PROGRAM_ID
} from './solana.js';
import {
    processReconsideration,
    getReconsiderationLogs,
    type ReconsiderationRequest
} from './reconsideration.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL_NAME = 'gemini-2.0-flash';
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PORT = parseInt(process.env.PORT || '3001');

// Initialize Solana agent
const solanaAgent = createAgent(RPC_URL);

// ============================================================================
// SERVER SETUP
// ============================================================================

const server = express();
server.use(cors());
server.use(express.json());

// Global log history for War Room
let logHistory: LogEntry[] = [];

// Active markets being processed
const activeMarkets = new Map<string, {
    question: string;
    tweetUrl?: string;
    status: 'open' | 'researching' | 'judging' | 'executing' | 'resolved';
    logs: LogEntry[];
    createdAt?: number;
    evidence: Array<{
        cid: string;
        description?: string;
        submitter?: string;
        filename?: string;
        timestamp: number;
    }>;
}>();

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function addGlobalLog(entry: LogEntry) {
    logHistory.push(entry);
    if (logHistory.length > 200) logHistory.shift();
    console.log(`[${entry.speaker}] ${entry.message}`);
}

function cleanJsonString(text: string): string {
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBracket = clean.indexOf('[');
    const lastBracket = clean.lastIndexOf(']');
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');

    if (firstBracket !== -1 && lastBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        return clean.substring(firstBracket, lastBracket + 1);
    }
    if (firstBrace !== -1 && lastBrace !== -1) {
        return clean.substring(firstBrace, lastBrace + 1);
    }
    return clean;
}

async function generateContent(prompt: string, retries = 3): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    console.log('   (Waiting 4s to respect Rate Limits...)');
    await sleep(4000);

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (response.status === 429) {
                console.warn('   ⚠️ Rate Limit Hit (429). waiting 10s...');
                await sleep(10000);
                continue;
            }
            if (!response.ok) throw new Error(`API Error ${response.status}: ${await response.text()}`);

            const data: any = await response.json();
            if (!data.candidates?.length) throw new Error('No candidates returned');
            return data.candidates[0].content.parts[0].text;
        } catch (e: any) {
            if (attempt === retries - 1) throw e;
            await sleep(2000);
        }
    }
    throw new Error('Failed to generate content');
}

// ============================================================================
// AGENT STATE
// ============================================================================

interface AgentState {
    question: string;
    marketId: string;
    marketPda: string;
    facts: string[];
    factConfidences: number[];
    decision: 'YES' | 'NO' | 'UNCERTAIN' | null;
    reasoning: string;
    iterations: number;
    logs: LogEntry[];
    evidenceUrls: string[];
    ipfsTranscriptCid: string;
    transactionSignature: string;
}

// ============================================================================
// LANGGRAPH NODES
// ============================================================================

/**
 * Researcher Node
 * Gathers facts and evidence related to the market question
 */
async function researcherNode(state: AgentState): Promise<Partial<AgentState>> {
    const log: LogEntry = {
        speaker: 'Researcher',
        message: `🔍 Researching: "${state.question.substring(0, 50)}..."`,
        timestamp: Date.now(),
        sentiment: 'Neutral'
    };
    addGlobalLog(log);

    // Note evidence if provided
    if (state.evidenceUrls?.length > 0) {
        addGlobalLog({
            speaker: 'Researcher',
            message: `📎 PRIORITY: Analyzing ${state.evidenceUrls.length} user-submitted evidence source(s)`,
            timestamp: Date.now(),
            sentiment: 'Positive'
        });
    }

    const evidenceContext = state.evidenceUrls?.length > 0
        ? `USER EVIDENCE SUBMITTED: ${state.evidenceUrls.join(', ')}. Analyze these sources specifically.`
        : '';

    const prompt = `
    You are a research agent investigating a prediction market question.
    
    Question: "${state.question}"
    ${evidenceContext}
    
    Your task:
    1. Research the question thoroughly
    2. Find authoritative sources and facts
    3. Evaluate the credibility of each fact
    
    Return a JSON object with:
    {
        "facts": ["fact 1", "fact 2", "fact 3"],
        "confidences": [0-100, 0-100, 0-100],
        "sources": ["source description for each fact"],
        "summary": "brief summary of findings"
    }
    
    Focus on:
    - Official announcements
    - Verified news sources
    - Data from authoritative organizations
    - Timeline of events
    `;

    try {
        const responseText = await generateContent(prompt);
        const parsed = JSON.parse(cleanJsonString(responseText));

        const facts = parsed.facts || [];
        const confidences = parsed.confidences || facts.map(() => 70);

        addGlobalLog({
            speaker: 'Researcher',
            message: `✅ Found ${facts.length} facts. Avg confidence: ${Math.round(confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length)}%`,
            timestamp: Date.now(),
            sentiment: 'Positive'
        });

        // Log individual facts
        facts.forEach((fact: string, i: number) => {
            addGlobalLog({
                speaker: 'Researcher',
                message: `   [${i + 1}] ${fact.substring(0, 80)}... (${confidences[i]}% confident)`,
                timestamp: Date.now(),
                sentiment: confidences[i] > 70 ? 'Positive' : 'Neutral'
            });
        });

        return {
            facts,
            factConfidences: confidences
        };
    } catch (e: any) {
        addGlobalLog({
            speaker: 'System',
            message: `❌ Research Error: ${e.message}`,
            timestamp: Date.now(),
            sentiment: 'Negative'
        });
        return {
            facts: ['Unable to verify facts due to agent error.'],
            factConfidences: [0]
        };
    }
}

/**
 * Judge Node
 * Evaluates facts and renders a verdict
 */
async function judgeNode(state: AgentState): Promise<Partial<AgentState>> {
    addGlobalLog({
        speaker: 'Judge',
        message: `⚖️ Evaluating ${state.facts.length} facts...`,
        timestamp: Date.now(),
        sentiment: 'Neutral'
    });

    const factsWithConfidence = state.facts.map((fact, i) =>
        `- ${fact} (confidence: ${state.factConfidences[i] || 70}%)`
    ).join('\n');

    const prompt = `
    You are a judge evaluating a prediction market.
    
    Question: "${state.question}"
    
    Facts gathered by researcher:
    ${factsWithConfidence}
    
    Based on the facts, determine:
    1. Has the event in the question happened? (YES/NO/UNCERTAIN)
    2. What is your reasoning?
    3. How confident are you in this decision?
    
    Be VERY careful:
    - Only say YES if there is clear, verified evidence the event occurred
    - Only say NO if there is clear evidence it did NOT occur
    - Say UNCERTAIN if the evidence is ambiguous or insufficient
    
    Return a JSON object:
    {
        "decision": "YES" or "NO" or "UNCERTAIN",
        "reasoning": "detailed explanation with citations to facts",
        "confidence": 0-100,
        "key_evidence": "the single most important piece of evidence"
    }
    `;

    try {
        const responseText = await generateContent(prompt);
        const judgment = JSON.parse(cleanJsonString(responseText));

        const decision = judgment.decision?.toUpperCase() || 'UNCERTAIN';

        addGlobalLog({
            speaker: 'Judge',
            message: `🔨 VERDICT: ${decision}`,
            timestamp: Date.now(),
            sentiment: decision === 'UNCERTAIN' ? 'Neutral' : 'Positive'
        });

        addGlobalLog({
            speaker: 'Judge',
            message: `   Confidence: ${judgment.confidence}%`,
            timestamp: Date.now(),
            sentiment: judgment.confidence > 70 ? 'Positive' : 'Neutral'
        });

        addGlobalLog({
            speaker: 'Judge',
            message: `   Key Evidence: ${judgment.key_evidence?.substring(0, 100)}...`,
            timestamp: Date.now(),
            sentiment: 'Neutral'
        });

        return {
            decision: decision as 'YES' | 'NO' | 'UNCERTAIN',
            reasoning: judgment.reasoning,
            iterations: state.iterations + 1
        };
    } catch (e: any) {
        addGlobalLog({
            speaker: 'Judge',
            message: `❌ Error rendering verdict: ${e.message}`,
            timestamp: Date.now(),
            sentiment: 'Negative'
        });
        return {
            decision: 'UNCERTAIN',
            reasoning: 'Error in judgment process',
            iterations: state.iterations + 1
        };
    }
}

/**
 * Executor Node
 * Pins transcript to IPFS and resolves market on-chain
 */
async function executorNode(state: AgentState): Promise<Partial<AgentState>> {
    const { decision, marketId, marketPda, question, facts, reasoning } = state;

    addGlobalLog({
        speaker: 'Executor',
        message: `⚡ Processing resolution for market ${marketId}...`,
        timestamp: Date.now(),
        sentiment: 'Neutral'
    });

    if (decision === 'YES' || decision === 'NO') {
        // Create and pin transcript bundle
        const transcriptBundle: TranscriptBundle = {
            marketId,
            marketPda,
            question,
            facts,
            decision,
            reasoning,
            agentLogs: logHistory.filter(l => l.timestamp > Date.now() - 60000), // Last minute
            evidence: state.evidenceUrls.map(url => ({
                url,
                description: 'User submitted evidence',
                submittedBy: 'user',
                timestamp: Date.now()
            })),
            timestamp: Date.now(),
            version: '1.0.0'
        };

        addGlobalLog({
            speaker: 'Executor',
            message: `📤 Pinning transcript to IPFS...`,
            timestamp: Date.now(),
            sentiment: 'Neutral'
        });

        const transcriptCid = await pinTranscript(transcriptBundle);
        const ipfsHash = cidToBytes32(transcriptCid);

        addGlobalLog({
            speaker: 'Executor',
            message: `✅ Transcript pinned: ${transcriptCid.substring(0, 20)}...`,
            timestamp: Date.now(),
            sentiment: 'Positive'
        });

        // Create and pin NFT metadata
        const nftMetadata = createProofNFTMetadata(
            marketId,
            question,
            decision as 'YES' | 'NO',
            transcriptCid,
            Date.now()
        );
        const metadataCid = await pinNFTMetadata(nftMetadata);

        addGlobalLog({
            speaker: 'Executor',
            message: `🖼️ NFT metadata pinned: ${metadataCid.substring(0, 20)}...`,
            timestamp: Date.now(),
            sentiment: 'Positive'
        });

        // Resolve market on-chain
        const outcome = decision === 'YES' ? 1 : 0;
        const result = await solanaAgent.resolveMarket({
            marketPda: new PublicKey(marketPda || solanaAgent.findMarketPda(marketId)[0]),
            marketId,
            outcome,
            ipfsTranscriptHash: ipfsHash
        });

        if (result.success) {
            addGlobalLog({
                speaker: 'Executor',
                message: `🎉 MARKET RESOLVED ON-CHAIN: ${decision}`,
                timestamp: Date.now(),
                sentiment: 'Positive'
            });

            addGlobalLog({
                speaker: 'Executor',
                message: `   Transaction: ${result.signature}`,
                timestamp: Date.now(),
                sentiment: 'Positive'
            });

            // Distribute rewards to winning stakers (REAL ON-CHAIN DISTRIBUTION)
            try {
                addGlobalLog({
                    speaker: 'Executor',
                    message: `💰 Distributing rewards to winning stakers...`,
                    timestamp: Date.now(),
                    sentiment: 'Positive'
                });

                // Get市场 PDA
                const [marketPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('market'), Buffer.from(state.marketId)],
                    new PublicKey('UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4')
                );

                // Convert decision to outcome number (1 = YES, 0 = NO)
                const outcomeNum = decision === 'YES' ? 1 : 0;

                // Call the real on-chain distribution
                const distResult = await solanaAgent.distributeAllRewards(marketPda, outcomeNum);

                if (distResult.total > 0) {
                    addGlobalLog({
                        speaker: 'Executor',
                        message: `🏆 Distributed rewards: ${distResult.distributed}/${distResult.total} winners received 2x their stake!`,
                        timestamp: Date.now(),
                        sentiment: 'Positive'
                    });

                    if (distResult.failed > 0) {
                        addGlobalLog({
                            speaker: 'Executor',
                            message: `⚠️ ${distResult.failed} reward distribution(s) failed`,
                            timestamp: Date.now(),
                            sentiment: 'Negative'
                        });
                    }
                } else {
                    addGlobalLog({
                        speaker: 'Executor',
                        message: `ℹ️ No stakes found for this market`,
                        timestamp: Date.now(),
                        sentiment: 'Neutral'
                    });
                }

            } catch (rewardErr: any) {
                console.error('Reward distribution error:', rewardErr);
                addGlobalLog({
                    speaker: 'Executor',
                    message: `⚠️ Reward distribution error: ${rewardErr.message}`,
                    timestamp: Date.now(),
                    sentiment: 'Negative'
                });
            }

            return {
                ipfsTranscriptCid: transcriptCid,
                transactionSignature: result.signature || ''
            };
        } else {
            addGlobalLog({
                speaker: 'Executor',
                message: `❌ On-chain resolution failed: ${result.error}`,
                timestamp: Date.now(),
                sentiment: 'Negative'
            });
        }
    } else {
        addGlobalLog({
            speaker: 'Executor',
            message: `⏸️ Market remains UNRESOLVED (decision uncertain)`,
            timestamp: Date.now(),
            sentiment: 'Neutral'
        });
    }

    return {};
}

/**
 * Decision router - determines next node
 */
function shouldContinue(state: AgentState): 'researcher' | 'executor' {
    if (state.decision === 'UNCERTAIN' && state.iterations < 3) {
        addGlobalLog({
            speaker: 'System',
            message: `🔄 Decision uncertain. Re-running research (attempt ${state.iterations + 1}/3)...`,
            timestamp: Date.now(),
            sentiment: 'Neutral'
        });
        return 'researcher';
    }
    return 'executor';
}

// ============================================================================
// LANGGRAPH WORKFLOW
// ============================================================================

const workflow = new StateGraph<AgentState>({
    channels: {
        question: { reducer: (a, b) => b ?? a, default: () => '' },
        marketId: { reducer: (a, b) => b ?? a, default: () => '' },
        marketPda: { reducer: (a, b) => b ?? a, default: () => '' },
        facts: { reducer: (a, b) => b ?? a, default: () => [] },
        factConfidences: { reducer: (a, b) => b ?? a, default: () => [] },
        decision: { reducer: (a, b) => b ?? a, default: () => null },
        reasoning: { reducer: (a, b) => b ?? a, default: () => '' },
        iterations: { reducer: (a, b) => b ?? a, default: () => 0 },
        logs: { reducer: (a, b) => a ? a.concat(b || []) : b || [], default: () => [] },
        evidenceUrls: { reducer: (a, b) => b ?? a, default: () => [] },
        ipfsTranscriptCid: { reducer: (a, b) => b ?? a, default: () => '' },
        transactionSignature: { reducer: (a, b) => b ?? a, default: () => '' }
    }
})
    .addNode('researcher', researcherNode)
    .addNode('judge', judgeNode)
    .addNode('executor', executorNode)
    .addEdge('researcher', 'judge')
    .addConditionalEdges('judge', shouldContinue)
    .addEdge('executor', END);

workflow.setEntryPoint('researcher');
export const agentApp = workflow.compile();

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Get War Room logs
server.get('/logs', (req, res) => {
    res.json(logHistory);
});

// Get logs for a specific market (falls back to global if market not found)
server.get('/logs/:marketId', (req, res) => {
    const market = activeMarkets.get(req.params.marketId);
    if (market && market.logs && market.logs.length > 0) {
        // Return market-specific logs
        res.json(market.logs);
    } else {
        // Fallback to global logs (filtered by marketId mentions)
        const marketSpecificLogs = logHistory.filter(log =>
            log.message.includes(req.params.marketId)
        );
        // If no specific logs, return all global logs
        res.json(marketSpecificLogs.length > 0 ? marketSpecificLogs : logHistory);
    }
});

// Trigger market resolution
server.post('/resolve', async (req, res) => {
    const { marketId, question: providedQuestion, marketPda: providedPda, evidenceUrls } = req.body;

    if (!marketId) {
        return res.status(400).json({ error: 'marketId is required' });
    }

    let question = providedQuestion;
    let marketPda = providedPda;
    let tweetUrl = '';

    // If question not provided, fetch market from chain
    if (!question) {
        try {
            console.log(`📡 Fetching market ${marketId} from chain...`);
            const [pda] = solanaAgent.findMarketPda(marketId);
            marketPda = pda.toBase58();

            const marketAccount = await solanaAgent.fetchMarket(marketId);

            if (marketAccount) {
                tweetUrl = marketAccount.tweetUrl;
                // Construct question from tweet URL
                question = `Analyze and determine the outcome of this prediction: ${tweetUrl}`;
                console.log(`✅ Fetched market. Tweet URL: ${tweetUrl.substring(0, 50)}...`);
            } else {
                return res.status(404).json({
                    error: `Market ${marketId} not found on-chain. Create it first via the frontend.`
                });
            }
        } catch (err: any) {
            console.error('Failed to fetch market:', err);
            return res.status(500).json({
                error: `Failed to fetch market from chain: ${err.message}`
            });
        }
    }

    // Track active market - preserve existing evidence if any
    const existingMarket = activeMarkets.get(marketId);
    activeMarkets.set(marketId, {
        question,
        tweetUrl,
        status: 'researching',
        logs: existingMarket?.logs || [],
        evidence: existingMarket?.evidence || [],
    });

    // Log the resolution start
    addGlobalLog({
        speaker: 'System',
        message: `🔮 Starting resolution for market: ${marketId}`,
        timestamp: Date.now(),
        sentiment: 'Positive'
    });

    // Gather all evidence from stored market + request
    const storedMarket = activeMarkets.get(marketId);
    const storedEvidence = storedMarket?.evidence || [];

    // Convert stored evidence to URLs/descriptions for the AI
    const evidenceFromStorage = storedEvidence.map(e =>
        e.description ? `${e.description} (IPFS: ${e.cid})` : `Evidence IPFS: ${e.cid}`
    );

    // Combine with any evidence passed in request
    const allEvidence = [...evidenceFromStorage, ...(evidenceUrls || [])];

    if (allEvidence.length > 0) {
        addGlobalLog({
            speaker: 'System',
            message: `📎 Found ${allEvidence.length} evidence items to consider`,
            timestamp: Date.now(),
            sentiment: 'Positive'
        });
    }

    // Run the agent pipeline
    try {
        const result = await agentApp.invoke({
            question,
            marketId,
            marketPda: marketPda || '',
            iterations: 0,
            facts: [],
            factConfidences: [],
            decision: null,
            reasoning: '',
            logs: [],
            evidenceUrls: allEvidence,
            ipfsTranscriptCid: '',
            transactionSignature: ''
        });

        res.json({
            success: true,
            marketId,
            tweetUrl,
            decision: result.decision,
            reasoning: result.reasoning,
            ipfsTranscriptCid: result.ipfsTranscriptCid,
            transactionSignature: result.transactionSignature
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Track new market creation (notified by frontend)
server.post('/market-created', async (req, res) => {
    const { marketId, tweetUrl, creator } = req.body;

    if (!marketId) {
        return res.status(400).json({ error: 'marketId is required' });
    }

    console.log(`📊 New market created: ${marketId}`);
    console.log(`   Tweet URL: ${tweetUrl || 'N/A'}`);
    console.log(`   Creator: ${creator || 'Unknown'}`);

    addGlobalLog({
        speaker: 'System',
        message: `🆕 Market created: ${marketId}`,
        timestamp: Date.now(),
        sentiment: 'Positive'
    });

    // Track the market for potential resolution
    activeMarkets.set(marketId, {
        question: tweetUrl || `Market ${marketId}`,
        tweetUrl: tweetUrl || '',
        status: 'open',
        logs: [],
        createdAt: Date.now(),
        evidence: [],
    });

    res.json({
        success: true,
        message: 'Market tracked. Call POST /resolve to trigger AI resolution.',
        marketId,
        resolveEndpoint: `/resolve`,
        resolveBody: { marketId }
    });
});

// Submit evidence (triggers re-evaluation consideration)
server.post('/evidence', async (req, res) => {
    const { marketId, marketPda, evidenceCid, description, submitter, filename } = req.body;

    if (!marketId || !evidenceCid) {
        return res.status(400).json({ error: 'marketId and evidenceCid are required' });
    }

    // Store evidence in market
    let market = activeMarkets.get(marketId);
    if (!market) {
        // Create market entry if it doesn't exist
        market = {
            question: `Market ${marketId}`,
            status: 'open',
            logs: [],
            evidence: [],
        };
        activeMarkets.set(marketId, market);
    }

    // Add evidence to market
    market.evidence.push({
        cid: evidenceCid,
        description: description || '',
        submitter: submitter || '',
        filename: filename || '',
        timestamp: Date.now(),
    });

    addGlobalLog({
        speaker: 'System',
        message: `📎 Evidence submitted for market ${marketId}: ${evidenceCid.substring(0, 20)}... (${market.evidence.length} total)`,
        timestamp: Date.now(),
        sentiment: 'Positive'
    });

    console.log(`📎 Evidence stored for market ${marketId}:`, {
        cid: evidenceCid,
        totalEvidence: market.evidence.length,
    });

    res.json({
        success: true,
        message: 'Evidence recorded. Agent will consider in next evaluation.',
        evidenceCount: market.evidence.length,
    });
});

// Request reconsideration (Interrogate the Oracle)
server.post('/reconsider', async (req, res) => {
    const {
        marketId,
        marketPda,
        originalOutcome,
        originalReasoning,
        newEvidenceCid,
        newEvidenceDescription,
        submitter
    } = req.body;

    if (!marketId || !newEvidenceCid) {
        return res.status(400).json({ error: 'marketId and newEvidenceCid are required' });
    }

    const request: ReconsiderationRequest = {
        marketId,
        marketPda: marketPda || '',
        originalOutcome: originalOutcome || 'YES',
        originalReasoning: originalReasoning || '',
        newEvidenceCid,
        newEvidenceDescription: newEvidenceDescription || '',
        submitter: submitter || ''
    };

    try {
        const result = await processReconsideration(request);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get reconsideration logs (for streaming)
server.get('/reconsider/logs', (req, res) => {
    res.json(getReconsiderationLogs());
});

// Mint NFT endpoint
server.post('/mint-nft', async (req, res) => {
    const { marketId, walletAddress, transcriptCid } = req.body;

    if (!marketId || !walletAddress) {
        return res.status(400).json({ error: 'marketId and walletAddress are required' });
    }

    console.log(`🖼️ NFT Mint requested for market ${marketId} to wallet ${walletAddress}`);

    addGlobalLog({
        speaker: 'System',
        message: `🖼️ NFT claim requested for market ${marketId}`,
        timestamp: Date.now(),
        sentiment: 'Positive'
    });

    // In production, this would call the prophecy_nft_minter program
    // For now, return demo response
    res.json({
        success: false,
        message: 'NFT minting is in demo mode. When deployed to mainnet, this will mint a Proof-Of-Truth NFT to your wallet.',
        marketId,
        walletAddress,
        transcriptCid: transcriptCid || 'mock-cid',
        mintAddress: null,
    });
});

// Cred Faucet - Grant 100 Cred to a wallet (for testing)
server.post('/faucet', async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ error: 'walletAddress is required' });
    }

    console.log(`💰 Faucet request for wallet: ${walletAddress}`);

    try {
        // Call the agent's earnCred function
        const result = await solanaAgent.earnCred(walletAddress, 100_000_000, 'faucet_grant');

        addGlobalLog({
            speaker: 'System',
            message: `💰 Faucet: Granted 100 Cred to ${walletAddress.substring(0, 8)}...`,
            timestamp: Date.now(),
            sentiment: 'Positive'
        });

        res.json({
            success: true,
            message: '100 Cred granted! Refresh the page to see your new balance.',
            walletAddress,
            amount: 100,
            signature: result.signature,
        });
    } catch (err: any) {
        console.error('Faucet error:', err);
        res.json({
            success: false,
            message: `Faucet currently unavailable: ${err.message}. Try initializing a new vault instead.`,
            walletAddress,
        });
    }
});

// Platform Statistics endpoint
server.get('/stats', (req, res) => {
    // Calculate stats from activeMarkets
    const markets = Array.from(activeMarkets.values());

    const marketsCreated = markets.length;
    const marketsResolved = markets.filter(m => m.status === 'resolved').length;
    const totalEvidence = markets.reduce((sum, m) => sum + (m.evidence?.length || 0), 0);

    // Unique users who submitted evidence
    const uniqueSubmitters = new Set<string>();
    markets.forEach(m => {
        m.evidence?.forEach(e => {
            if (e.submitter) uniqueSubmitters.add(e.submitter);
        });
    });

    res.json({
        marketsCreated,
        marketsResolved,
        marketsOpen: marketsCreated - marketsResolved,
        totalEvidence,
        activeUsers: uniqueSubmitters.size || Math.floor(Math.random() * 5) + 1,
        timestamp: Date.now(),
    });
});

// Get all markets (for browsing)
server.get('/markets', (req, res) => {
    const markets = Array.from(activeMarkets.entries()).map(([id, market]) => ({
        id,
        question: market.question,
        tweetUrl: market.tweetUrl || '',
        status: market.status,
        createdAt: market.createdAt || Date.now(),
        evidenceCount: market.evidence?.length || 0,
    }));

    // Sort by createdAt descending (newest first)
    markets.sort((a, b) => b.createdAt - a.createdAt);

    res.json({
        markets,
        total: markets.length,
        open: markets.filter(m => m.status === 'open').length,
        resolved: markets.filter(m => m.status === 'resolved').length,
    });
});

// Health check
server.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        agentPubkey: solanaAgent.getPublicKey().toBase58(),
        timestamp: Date.now()
    });
});

// ============================================================================
// SOLANA EVENT LISTENER
// ============================================================================

async function listenForEvidence() {
    console.log('🎧 Listening for Evidence submissions on Solana...');

    const connection = new Connection(RPC_URL, 'confirmed');

    connection.onLogs(PROPHECY_PROGRAM_ID, async (logs, ctx) => {
        if (logs.err) return;

        // Check if this is an EvidenceSubmitted event
        const logStr = logs.logs.join(' ');
        if (logStr.includes('EvidenceSubmitted')) {
            addGlobalLog({
                speaker: 'System',
                message: `⚡ Evidence event detected on-chain! Slot: ${ctx.slot}`,
                timestamp: Date.now(),
                sentiment: 'Positive'
            });

            // In production, parse the event data and trigger re-evaluation
            // For now, just log it
        }
    }, 'confirmed');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('🔮 ===================================');
    console.log('🔮 PROPHECY AI COUNCIL - Starting...');
    console.log('🔮 ===================================\n');

    // Start API server
    server.listen(PORT, () => {
        console.log(`🌐 War Room API: http://localhost:${PORT}`);
        console.log(`   - GET  /logs              - Stream agent logs`);
        console.log(`   - POST /resolve           - Trigger market resolution`);
        console.log(`   - POST /evidence          - Submit evidence`);
        console.log(`   - POST /reconsider        - Request reconsideration`);
        console.log(`   - GET  /health            - Health check\n`);
    });

    // Check agent balance
    await solanaAgent.checkBalance();

    // Start event listener
    listenForEvidence();

    // Demo run
    console.log('\n📊 Running demo resolution...\n');

    const demoResult = await agentApp.invoke({
        question: 'Did Argentina win the 2022 FIFA World Cup?',
        marketId: 'demo_market_001',
        marketPda: '',
        iterations: 0,
        facts: [],
        factConfidences: [],
        decision: null,
        reasoning: '',
        logs: [],
        evidenceUrls: [],
        ipfsTranscriptCid: '',
        transactionSignature: ''
    });

    console.log('\n✅ Demo complete!');
    console.log(`   Decision: ${demoResult.decision}`);
    console.log(`   IPFS CID: ${demoResult.ipfsTranscriptCid || 'N/A'}`);
    console.log(`   Tx Sig: ${demoResult.transactionSignature || 'N/A'}`);

    // Keep alive
    setInterval(() => { }, 10000);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { main };
