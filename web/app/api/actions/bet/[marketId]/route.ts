import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';

// Solana Actions (Blinks) API endpoint
// See: https://docs.dialect.to/documentation/actions/actions/building-actions

const PROPHECY_PROGRAM_ID = new PublicKey('UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4');
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || 'https://api.devnet.solana.com';

// PDA Seeds
const MARKET_SEED = Buffer.from('market');
const REPUTATION_VAULT_SEED = Buffer.from('reputation_vault');
const CRED_STAKE_SEED = Buffer.from('cred_stake');

// CORS headers for Blinks
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Encoding',
    'Access-Control-Expose-Headers': 'X-Action-Version, X-Blockchain-Ids',
    'X-Action-Version': '2.1.3',
    'X-Blockchain-Ids': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
};

// Helper to find PDAs
function findMarketPda(marketId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [MARKET_SEED, Buffer.from(marketId)],
        PROPHECY_PROGRAM_ID
    );
}

function findReputationVaultPda(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [REPUTATION_VAULT_SEED, owner.toBuffer()],
        PROPHECY_PROGRAM_ID
    );
}

function findCredStakePda(marketPda: PublicKey, user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [CRED_STAKE_SEED, marketPda.toBuffer(), user.toBuffer()],
        PROPHECY_PROGRAM_ID
    );
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, { headers: corsHeaders });
}

// GET - Return Action metadata for Blink rendering
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ marketId: string }> }
) {
    const { marketId } = await params;
    const connection = new Connection(RPC_URL, 'confirmed');

    // Try to fetch market data from chain
    const marketData = {
        question: `Prediction market: ${marketId}`,
        totalYesStake: 0,
        totalNoStake: 0,
        status: 'open',
    };

    try {
        const [marketPda] = findMarketPda(marketId);
        const accountInfo = await connection.getAccountInfo(marketPda);

        if (accountInfo) {
            // Parse market data (simplified - in production use Anchor's deserialize)
            // For now, we'll show basic info
            marketData.question = `Market ${marketId} - Make your prediction!`;
            marketData.status = 'open';
        }
    } catch (err) {
        console.log('Could not fetch market data:', err);
    }

    const actionMetadata = {
        type: 'action',
        title: '🔮 Prophecy Prediction Market',
        icon: 'https://prophecy-two.vercel.app/prophecy-icon.png',
        description: marketData.question,
        label: 'Make Prediction',
        links: {
            actions: [
                {
                    type: 'transaction',
                    label: `✅ Signal YES (50 Cred)`,
                    href: `/api/actions/bet/${marketId}?direction=yes&amount=50`,
                },
                {
                    type: 'transaction',
                    label: `❌ Signal NO (50 Cred)`,
                    href: `/api/actions/bet/${marketId}?direction=no&amount=50`,
                },
                {
                    type: 'transaction',
                    label: 'Custom Amount',
                    href: `/api/actions/bet/${marketId}?direction={direction}&amount={amount}`,
                    parameters: [
                        {
                            name: 'direction',
                            label: 'Direction',
                            required: true,
                            type: 'select',
                            options: [
                                { label: 'YES', value: 'yes' },
                                { label: 'NO', value: 'no' },
                            ],
                        },
                        {
                            name: 'amount',
                            label: 'Cred Amount',
                            required: true,
                            type: 'number',
                            min: 10,
                            max: 1000,
                        },
                    ],
                },
            ],
        },
        disabled: false,
        error: undefined,
    };

    return NextResponse.json(actionMetadata, { headers: corsHeaders });
}

// POST - Build stake_cred transaction for user to sign
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ marketId: string }> }
) {
    try {
        const { marketId } = await params;
        const { searchParams } = new URL(request.url);
        const directionParam = searchParams.get('direction') || 'yes';
        const amountParam = searchParams.get('amount') || '50';

        // Validate parameters (handle template placeholders from validator)
        const validDirections = ['yes', 'no'];
        const direction = validDirections.includes(directionParam.toLowerCase())
            ? directionParam.toLowerCase()
            : 'yes';

        // Parse amount, default to 50 if invalid (e.g., "{amount}" from validator)
        const amount = parseInt(amountParam);
        if (isNaN(amount) || amount < 10 || amount > 1000) {
            return NextResponse.json(
                { message: 'Invalid amount. Please enter a number between 10 and 1000.' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Get user's account from request body
        const body = await request.json();
        const userAccount = body.account;

        if (!userAccount) {
            return NextResponse.json(
                { message: 'Missing account in request body' },
                { status: 400, headers: corsHeaders }
            );
        }

        const userPubkey = new PublicKey(userAccount);
        const connection = new Connection(RPC_URL, 'confirmed');

        // Find all required PDAs (these are deterministic, no RPC needed)
        const [marketPda] = findMarketPda(marketId);
        const [reputationVaultPda] = findReputationVaultPda(userPubkey);
        const [credStakePda] = findCredStakePda(marketPda, userPubkey);

        // NOTE: We skip on-chain validation here to prevent RPC timeout.
        // If market or vault doesn't exist, the transaction will fail at signing time
        // with a clear Solana error message. This is better UX than timing out.

        // Build the stake_cred instruction
        // Anchor discriminator for stake_cred (first 8 bytes of sha256("global:stake_cred"))
        const discriminator = Buffer.from([126, 237, 26, 104, 67, 69, 118, 185]);

        // Encode instruction data: discriminator + direction (bool) + amount (u64)
        const instructionData = Buffer.alloc(8 + 1 + 8);
        discriminator.copy(instructionData, 0);
        instructionData.writeUInt8(direction === 'yes' ? 1 : 0, 8);
        instructionData.writeBigUInt64LE(BigInt(amount * 1_000_000), 9); // Convert to micro-Cred

        // Create the stake_cred instruction
        const stakeCredInstruction = new TransactionInstruction({
            programId: PROPHECY_PROGRAM_ID,
            keys: [
                { pubkey: marketPda, isSigner: false, isWritable: true },
                { pubkey: reputationVaultPda, isSigner: false, isWritable: true },
                { pubkey: credStakePda, isSigner: false, isWritable: true },
                { pubkey: userPubkey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: instructionData,
        });

        // Build transaction - only RPC call needed
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

        const transaction = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: userPubkey,
        });

        transaction.add(stakeCredInstruction);

        // Serialize the transaction
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        }).toString('base64');

        const response = {
            transaction: serializedTransaction,
            message: `Staking ${amount} Cred on ${direction.toUpperCase()} for market ${marketId}`,
        };

        return NextResponse.json(response, { headers: corsHeaders });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to build transaction';
        console.error('Error building transaction:', error);
        return NextResponse.json(
            { message: errorMessage },
            { status: 500, headers: corsHeaders }
        );
    }
}

