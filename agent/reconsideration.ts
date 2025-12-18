/**
 * Reconsideration Workflow - "Interrogate the Oracle"
 * 
 * Allows users to submit new evidence for re-evaluation of resolved markets.
 * The agent re-runs the research and judgment pipeline with the new evidence.
 */

import { StateGraph, END } from '@langchain/langgraph';
import { pinEvidence, cidToBytes32, type EvidenceItem, type LogEntry } from './ipfs.js';

// Types
export interface ReconsiderationRequest {
    marketId: string;
    marketPda: string;
    originalOutcome: 'YES' | 'NO';
    originalReasoning: string;
    newEvidenceCid: string;
    newEvidenceDescription: string;
    submitter: string;
}

export interface ReconsiderationResult {
    requestId: string;
    marketId: string;
    originalOutcome: 'YES' | 'NO';
    newOutcome: 'YES' | 'NO' | 'UNCHANGED';
    confidenceChange: number; // -100 to +100
    analysis: string;
    recommendation: 'UPHOLD' | 'ANNOTATE' | 'OVERTURN';
    annotationNote?: string;
    logs: LogEntry[];
    timestamp: number;
}

interface ReconsiderationState {
    request: ReconsiderationRequest;
    newEvidence: string;
    factAnalysis: string[];
    confidenceLevel: number;
    recommendation: 'UPHOLD' | 'ANNOTATE' | 'OVERTURN';
    reasoning: string;
    logs: LogEntry[];
}

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL_NAME = 'gemini-2.0-flash';

// Global logs for streaming
let reconsiderationLogs: LogEntry[] = [];

function addLog(entry: LogEntry) {
    reconsiderationLogs.push(entry);
    console.log(`[${entry.speaker}] ${entry.message}`);
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateContent(prompt: string, retries = 3): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    await sleep(2000); // Rate limit respect

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (response.status === 429) {
                await sleep(10000);
                continue;
            }
            if (!response.ok) throw new Error(`API Error ${response.status}`);

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

function cleanJsonString(text: string): string {
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        return clean.substring(firstBrace, lastBrace + 1);
    }
    return clean;
}

/**
 * Evidence Analyzer Node
 * Analyzes the new evidence and compares with original decision
 */
async function analyzeEvidenceNode(state: ReconsiderationState): Promise<Partial<ReconsiderationState>> {
    addLog({
        speaker: 'Researcher',
        message: `🔍 Analyzing new evidence for reconsideration...`,
        timestamp: Date.now(),
        sentiment: 'Neutral'
    });

    const prompt = `
    You are analyzing new evidence submitted for a prediction market reconsideration.
    
    Original Question: Market ${state.request.marketId}
    Original Outcome: ${state.request.originalOutcome}
    Original Reasoning: ${state.request.originalReasoning}
    
    New Evidence Submitted:
    - IPFS CID: ${state.request.newEvidenceCid}
    - Description: ${state.request.newEvidenceDescription}
    
    Analyze the new evidence and determine:
    1. Does this evidence contradict the original decision?
    2. What new facts does this evidence reveal?
    3. How credible is this evidence source?
    4. Does this warrant reconsideration?
    
    Return a JSON object with:
    {
        "facts": ["list of key facts from new evidence"],
        "contradicts_original": true/false,
        "credibility_score": 0-100,
        "warrants_reconsideration": true/false,
        "analysis": "detailed analysis text"
    }
    `;

    try {
        const response = await generateContent(prompt);
        const parsed = JSON.parse(cleanJsonString(response));

        addLog({
            speaker: 'Researcher',
            message: `Found ${parsed.facts?.length || 0} new facts. Credibility: ${parsed.credibility_score}%`,
            timestamp: Date.now(),
            sentiment: parsed.warrants_reconsideration ? 'Positive' : 'Neutral'
        });

        return {
            newEvidence: state.request.newEvidenceDescription,
            factAnalysis: parsed.facts || [],
            reasoning: parsed.analysis || ''
        };
    } catch (e: any) {
        addLog({
            speaker: 'System',
            message: `Evidence analysis error: ${e.message}`,
            timestamp: Date.now(),
            sentiment: 'Negative'
        });
        return {
            factAnalysis: ['Unable to analyze evidence'],
            reasoning: 'Analysis failed'
        };
    }
}

/**
 * Reconsideration Judge Node
 * Makes the final decision on whether to uphold, annotate, or overturn
 */
async function reconsiderationJudgeNode(state: ReconsiderationState): Promise<Partial<ReconsiderationState>> {
    addLog({
        speaker: 'Judge',
        message: `⚖️ Evaluating reconsideration request...`,
        timestamp: Date.now(),
        sentiment: 'Neutral'
    });

    const prompt = `
    You are a judge evaluating a reconsideration request for a prediction market.
    
    Original Outcome: ${state.request.originalOutcome}
    Original Reasoning: ${state.request.originalReasoning}
    
    New Evidence Analysis:
    ${state.factAnalysis.join('\n- ')}
    
    Analysis Summary: ${state.reasoning}
    
    Based on the new evidence, you must decide:
    
    1. UPHOLD - The original decision stands. New evidence is insufficient.
    2. ANNOTATE - Add a note to the resolution but don't change outcome.
    3. OVERTURN - Strong evidence warrants reversing the decision.
    
    IMPORTANT: Be VERY conservative about overturning. Only overturn if:
    - The new evidence is from highly credible, authoritative sources
    - The evidence directly and conclusively contradicts the original outcome
    - There is no ambiguity in the interpretation
    
    Return a JSON object:
    {
        "recommendation": "UPHOLD" or "ANNOTATE" or "OVERTURN",
        "confidence_level": 0-100,
        "reasoning": "detailed explanation",
        "annotation_note": "if ANNOTATE, what note to add" (optional)
    }
    `;

    try {
        const response = await generateContent(prompt);
        const parsed = JSON.parse(cleanJsonString(response));

        const recommendation = parsed.recommendation?.toUpperCase() || 'UPHOLD';

        addLog({
            speaker: 'Judge',
            message: `Verdict: ${recommendation}. Confidence: ${parsed.confidence_level}%`,
            timestamp: Date.now(),
            sentiment: recommendation === 'OVERTURN' ? 'Negative' : 'Positive'
        });

        if (recommendation === 'ANNOTATE' && parsed.annotation_note) {
            addLog({
                speaker: 'Judge',
                message: `Annotation: ${parsed.annotation_note}`,
                timestamp: Date.now(),
                sentiment: 'Neutral'
            });
        }

        return {
            recommendation: recommendation as 'UPHOLD' | 'ANNOTATE' | 'OVERTURN',
            confidenceLevel: parsed.confidence_level || 50,
            reasoning: parsed.reasoning || '',
            logs: reconsiderationLogs
        };
    } catch (e: any) {
        addLog({
            speaker: 'Judge',
            message: `Judgment error: ${e.message}. Defaulting to UPHOLD.`,
            timestamp: Date.now(),
            sentiment: 'Negative'
        });
        return {
            recommendation: 'UPHOLD',
            confidenceLevel: 0,
            reasoning: 'Error in judgment process'
        };
    }
}

// Build the reconsideration workflow
const reconsiderationWorkflow = new StateGraph<ReconsiderationState>({
    channels: {
        request: { reducer: (a, b) => b ?? a, default: () => ({} as ReconsiderationRequest) },
        newEvidence: { reducer: (a, b) => b ?? a, default: () => '' },
        factAnalysis: { reducer: (a, b) => b ?? a, default: () => [] },
        confidenceLevel: { reducer: (a, b) => b ?? a, default: () => 50 },
        recommendation: { reducer: (a, b) => b ?? a, default: () => 'UPHOLD' as const },
        reasoning: { reducer: (a, b) => b ?? a, default: () => '' },
        logs: { reducer: (a, b) => [...(a || []), ...(b || [])], default: () => [] }
    }
})
    .addNode('analyze_evidence', analyzeEvidenceNode)
    .addNode('judge_reconsideration', reconsiderationJudgeNode)
    .addEdge('analyze_evidence', 'judge_reconsideration')
    .addEdge('judge_reconsideration', END);

reconsiderationWorkflow.setEntryPoint('analyze_evidence');
const reconsiderationApp = reconsiderationWorkflow.compile();

/**
 * Process a reconsideration request
 */
export async function processReconsideration(
    request: ReconsiderationRequest
): Promise<ReconsiderationResult> {
    // Reset logs for this session
    reconsiderationLogs = [];

    addLog({
        speaker: 'System',
        message: `📋 Reconsideration request received for market ${request.marketId}`,
        timestamp: Date.now(),
        sentiment: 'Neutral'
    });

    const initialState: ReconsiderationState = {
        request,
        newEvidence: '',
        factAnalysis: [],
        confidenceLevel: 50,
        recommendation: 'UPHOLD',
        reasoning: '',
        logs: []
    };

    const result = await reconsiderationApp.invoke(initialState);

    // Calculate confidence change
    const confidenceChange = result.recommendation === 'OVERTURN'
        ? -result.confidenceLevel
        : result.recommendation === 'ANNOTATE'
            ? Math.round((result.confidenceLevel - 50) / 2)
            : 0;

    const newOutcome = result.recommendation === 'OVERTURN'
        ? (request.originalOutcome === 'YES' ? 'NO' : 'YES')
        : 'UNCHANGED';

    return {
        requestId: `recon_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        marketId: request.marketId,
        originalOutcome: request.originalOutcome,
        newOutcome: newOutcome as 'YES' | 'NO' | 'UNCHANGED',
        confidenceChange,
        analysis: result.reasoning,
        recommendation: result.recommendation,
        annotationNote: result.recommendation === 'ANNOTATE' ? result.reasoning : undefined,
        logs: reconsiderationLogs,
        timestamp: Date.now()
    };
}

/**
 * Get current reconsideration logs (for streaming UI)
 */
export function getReconsiderationLogs(): LogEntry[] {
    return reconsiderationLogs;
}
