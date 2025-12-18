/**
 * Initialize Global Accounts Script
 * 
 * Run this ONCE after deploying the programs to initialize:
 * - InsightPool
 * - AgentExecutor
 * 
 * Usage: npx tsx scripts/initialize.ts
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4');

async function main() {
    console.log('🚀 Prophecy Global Accounts Initialization\n');

    // Load keypair
    const keypairPath = process.env.KEYPAIR_PATH || path.join(process.env.HOME || '', '.config/solana/id.json');
    if (!fs.existsSync(keypairPath)) {
        console.error('❌ Keypair not found at:', keypairPath);
        process.exit(1);
    }

    const secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    console.log('🔑 Using keypair:', keypair.publicKey.toBase58());

    // Connect to Devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const wallet = new Wallet(keypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

    // Check balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log('💵 Balance:', (balance / 1e9).toFixed(4), 'SOL\n');

    if (balance < 0.01 * 1e9) {
        console.error('❌ Insufficient balance. Need at least 0.01 SOL');
        process.exit(1);
    }

    // Load IDL
    const idlPath = path.join(__dirname, '../target/idl/prophecy.json');
    if (!fs.existsSync(idlPath)) {
        console.error('❌ IDL not found. Run `anchor build` first.');
        process.exit(1);
    }
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
    const program = new Program(idl, provider);

    // Find PDAs
    const [insightPoolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('insight_pool')],
        PROGRAM_ID
    );
    const [agentExecutorPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('agent_executor')],
        PROGRAM_ID
    );

    console.log('📍 InsightPool PDA:', insightPoolPda.toBase58());
    console.log('📍 AgentExecutor PDA:', agentExecutorPda.toBase58());
    console.log('');

    // Check if already initialized
    const insightPoolAccount = await connection.getAccountInfo(insightPoolPda);
    const agentExecutorAccount = await connection.getAccountInfo(agentExecutorPda);

    // Initialize InsightPool
    if (!insightPoolAccount) {
        console.log('⏳ Initializing InsightPool...');
        try {
            const tx = await program.methods
                .initializeInsightPool()
                .accounts({
                    insightPool: insightPoolPda,
                    authority: keypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([keypair])
                .rpc();
            console.log('✅ InsightPool initialized. Tx:', tx);
        } catch (err: any) {
            console.error('❌ Failed to initialize InsightPool:', err.message);
        }
    } else {
        console.log('✓ InsightPool already initialized');
    }

    // Initialize AgentExecutor
    if (!agentExecutorAccount) {
        console.log('⏳ Initializing AgentExecutor...');
        try {
            const tx = await program.methods
                .initializeAgentExecutor()
                .accounts({
                    agentExecutor: agentExecutorPda,
                    authority: keypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([keypair])
                .rpc();
            console.log('✅ AgentExecutor initialized. Tx:', tx);
        } catch (err: any) {
            console.error('❌ Failed to initialize AgentExecutor:', err.message);
        }
    } else {
        console.log('✓ AgentExecutor already initialized');
    }

    console.log('\n🎉 Initialization complete!');
    console.log('\nNext steps:');
    console.log('1. Start the agent:    cd agent && npm run dev');
    console.log('2. Start the frontend: cd web && npm run dev');
    console.log('3. Create a market via the BlinkCreator');
}

main().catch(console.error);
