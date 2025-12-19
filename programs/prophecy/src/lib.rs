use anchor_lang::prelude::*;

declare_id!("UJW3ZdLcVxYuYDRpy6suu2DHCQhkUgCGKPUaDqdzSs4");

// ============================================================================
// CONSTANTS
// ============================================================================

pub const MAX_TWEET_URL_LEN: usize = 280;
pub const MAX_IPFS_CID_LEN: usize = 64;
pub const MAX_EVIDENCE_COUNT: u8 = 10;
pub const CRED_DECIMALS: u8 = 6;
pub const INITIAL_CRED_GRANT: u64 = 100_000_000; // 100 Cred with 6 decimals

// PDA Seeds
pub const INSIGHT_POOL_SEED: &[u8] = b"insight_pool";
pub const AGENT_EXECUTOR_SEED: &[u8] = b"agent_executor";
pub const REPUTATION_VAULT_SEED: &[u8] = b"reputation_vault";
pub const CRED_STAKE_SEED: &[u8] = b"cred_stake";
pub const MARKET_SEED: &[u8] = b"market";

// ============================================================================
// PROGRAM
// ============================================================================

#[program]
pub mod prophecy {
    use super::*;

    /// Initialize the global InsightPool - should only be called once
    pub fn initialize_insight_pool(ctx: Context<InitializeInsightPool>) -> Result<()> {
        let pool = &mut ctx.accounts.insight_pool;
        pool.total_credits = 0;
        pool.distributions_count = 0;
        pool.last_distribution = Clock::get()?.unix_timestamp;
        pool.authority = ctx.accounts.authority.key();
        pool.bump = ctx.bumps.insight_pool;

        msg!("InsightPool initialized");
        Ok(())
    }

    /// Initialize the AgentExecutor authority PDA
    pub fn initialize_agent_executor(ctx: Context<InitializeAgentExecutor>) -> Result<()> {
        let executor = &mut ctx.accounts.agent_executor;
        executor.authority = ctx.accounts.authority.key();
        executor.markets_resolved = 0;
        executor.bump = ctx.bumps.agent_executor;

        msg!("AgentExecutor initialized with authority: {}", executor.authority);
        Ok(())
    }

    /// Initialize a ReputationVault for a user - grants initial Cred
    pub fn initialize_reputation_vault(ctx: Context<InitializeReputationVault>) -> Result<()> {
        let vault = &mut ctx.accounts.reputation_vault;
        vault.owner = ctx.accounts.owner.key();
        vault.cred_balance = INITIAL_CRED_GRANT; // Grant initial Cred
        vault.total_earned = INITIAL_CRED_GRANT;
        vault.total_staked = 0;
        vault.participation_count = 0;
        vault.bump = ctx.bumps.reputation_vault;

        emit!(CredEarned {
            user: vault.owner,
            amount: INITIAL_CRED_GRANT,
            method: EarnMethod::InitialGrant,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("ReputationVault initialized for: {}", vault.owner);
        Ok(())
    }

    /// Create a new prediction market
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        tweet_url: String,
        market_id: String,
    ) -> Result<()> {
        require!(tweet_url.len() <= MAX_TWEET_URL_LEN, ErrorCode::TweetUrlTooLong);
        require!(market_id.len() <= 32, ErrorCode::MarketIdTooLong);

        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.tweet_url = tweet_url.clone();
        market.market_id = market_id.clone();
        market.created_at = Clock::get()?.unix_timestamp;
        market.status = MarketStatus::Open;
        market.outcome = None;
        market.ipfs_transcript_hash = [0u8; 32];
        market.insight_pool_amount = 0;
        market.agent_executor = ctx.accounts.agent_executor.key();
        market.evidence_count = 0;
        market.total_yes_stake = 0;
        market.total_no_stake = 0;
        market.bump = ctx.bumps.market;

        emit!(MarketCreated {
            market: market.key(),
            creator: market.creator,
            tweet_url,
            market_id,
            timestamp: market.created_at,
        });

        msg!("Market created: {}", market.key());
        Ok(())
    }

    /// Stake Cred on a market outcome (non-monetary participation)
    pub fn stake_cred(
        ctx: Context<StakeCred>,
        direction: bool, // true = Yes, false = No
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let vault = &mut ctx.accounts.reputation_vault;
        let market = &mut ctx.accounts.market;
        
        require!(market.status == MarketStatus::Open, ErrorCode::MarketNotOpen);
        require!(vault.cred_balance >= amount, ErrorCode::InsufficientCred);

        // Deduct from vault
        vault.cred_balance = vault.cred_balance.checked_sub(amount).ok_or(ErrorCode::Overflow)?;
        vault.total_staked = vault.total_staked.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        vault.participation_count = vault.participation_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        // Create stake record
        let stake = &mut ctx.accounts.cred_stake;
        stake.user = ctx.accounts.user.key();
        stake.market = market.key();
        stake.amount = amount;
        stake.direction = direction;
        stake.timestamp = Clock::get()?.unix_timestamp;
        stake.bump = ctx.bumps.cred_stake;

        // Update market totals
        if direction {
            market.total_yes_stake = market.total_yes_stake.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        } else {
            market.total_no_stake = market.total_no_stake.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        }

        emit!(CredStaked {
            market: market.key(),
            user: stake.user,
            amount,
            direction,
            timestamp: stake.timestamp,
        });

        msg!("Staked {} Cred on {} for market {}", amount, if direction { "YES" } else { "NO" }, market.key());
        Ok(())
    }

    /// Submit evidence for a market (IPFS CID)
    pub fn submit_evidence(
        ctx: Context<SubmitEvidence>,
        ipfs_cid: String,
    ) -> Result<()> {
        require!(ipfs_cid.len() <= MAX_IPFS_CID_LEN, ErrorCode::IpfsCidTooLong);
        
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, ErrorCode::MarketNotOpen);
        require!(market.evidence_count < MAX_EVIDENCE_COUNT, ErrorCode::TooManyEvidenceSubmissions);

        market.evidence_count = market.evidence_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        emit!(EvidenceSubmitted {
            market: market.key(),
            user: ctx.accounts.user.key(),
            ipfs_cid,
            evidence_index: market.evidence_count,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Evidence submitted to market: {}", market.key());
        Ok(())
    }

    /// Resolve a market - ONLY callable by the AgentExecutor authority
    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        outcome: u8, // 0 = No, 1 = Yes
        ipfs_transcript_hash: [u8; 32],
    ) -> Result<()> {
        require!(outcome <= 1, ErrorCode::InvalidOutcome);
        
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, ErrorCode::MarketNotOpen);
        
        // Verify the signer is the agent executor authority
        let executor = &ctx.accounts.agent_executor;
        require!(
            ctx.accounts.authority.key() == executor.authority,
            ErrorCode::UnauthorizedResolver
        );

        market.status = MarketStatus::Resolved;
        market.outcome = Some(outcome);
        market.ipfs_transcript_hash = ipfs_transcript_hash;

        // Increment executor stats
        let executor_mut = &mut ctx.accounts.agent_executor;
        executor_mut.markets_resolved = executor_mut.markets_resolved.checked_add(1).ok_or(ErrorCode::Overflow)?;

        let timestamp = Clock::get()?.unix_timestamp;

        emit!(MarketResolved {
            market: market.key(),
            outcome,
            ipfs_transcript_hash,
            resolver: ctx.accounts.authority.key(),
            timestamp,
        });

        // Emit NFT mint request
        emit!(ProofNFTMintRequested {
            market: market.key(),
            outcome,
            ipfs_transcript_hash,
            timestamp,
        });

        msg!("Market {} resolved with outcome: {}", market.key(), outcome);
        Ok(())
    }

    /// Distribute Cred rewards from InsightPool to winners
    pub fn distribute_insight_rewards(
        ctx: Context<DistributeInsightRewards>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let market = &ctx.accounts.market;
        require!(market.status == MarketStatus::Resolved, ErrorCode::MarketNotResolved);
        
        let stake = &ctx.accounts.cred_stake;
        let outcome = market.outcome.ok_or(ErrorCode::MarketNotResolved)?;
        
        // Check if user won (their direction matches the outcome)
        let user_won = (stake.direction && outcome == 1) || (!stake.direction && outcome == 0);
        require!(user_won, ErrorCode::UserDidNotWin);

        // Update recipient's vault
        let vault = &mut ctx.accounts.recipient_vault;
        vault.cred_balance = vault.cred_balance.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        vault.total_earned = vault.total_earned.checked_add(amount).ok_or(ErrorCode::Overflow)?;

        // Update insight pool
        let pool = &mut ctx.accounts.insight_pool;
        pool.total_credits = pool.total_credits.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        pool.distributions_count = pool.distributions_count.checked_add(1).ok_or(ErrorCode::Overflow)?;
        pool.last_distribution = Clock::get()?.unix_timestamp;

        emit!(CredDistributed {
            market: market.key(),
            recipient: vault.owner,
            amount,
            timestamp: pool.last_distribution,
        });

        msg!("Distributed {} Cred to {}", amount, vault.owner);
        Ok(())
    }

    /// Earn Cred through various contribution methods
    pub fn earn_cred(
        ctx: Context<EarnCred>,
        amount: u64,
        method: EarnMethod,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        // Verify authority (only authorized callers can mint Cred)
        let executor = &ctx.accounts.agent_executor;
        require!(
            ctx.accounts.authority.key() == executor.authority,
            ErrorCode::UnauthorizedMinter
        );

        let vault = &mut ctx.accounts.reputation_vault;
        vault.cred_balance = vault.cred_balance.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        vault.total_earned = vault.total_earned.checked_add(amount).ok_or(ErrorCode::Overflow)?;

        emit!(CredEarned {
            user: vault.owner,
            amount,
            method,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Earned {} Cred via {:?} for {}", amount, method, vault.owner);
        Ok(())
    }

    /// Dispute a market resolution (sets status to Disputed)
    pub fn dispute_market(ctx: Context<DisputeMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Resolved, ErrorCode::MarketNotResolved);
        
        market.status = MarketStatus::Disputed;

        emit!(MarketDisputed {
            market: market.key(),
            disputer: ctx.accounts.disputer.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Market {} disputed", market.key());
        Ok(())
    }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

#[derive(Accounts)]
pub struct InitializeInsightPool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + InsightPool::INIT_SPACE,
        seeds = [INSIGHT_POOL_SEED],
        bump
    )]
    pub insight_pool: Account<'info, InsightPool>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeAgentExecutor<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AgentExecutor::INIT_SPACE,
        seeds = [AGENT_EXECUTOR_SEED],
        bump
    )]
    pub agent_executor: Account<'info, AgentExecutor>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeReputationVault<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + ReputationVault::INIT_SPACE,
        seeds = [REPUTATION_VAULT_SEED, owner.key().as_ref()],
        bump
    )]
    pub reputation_vault: Account<'info, ReputationVault>,
    
    /// CHECK: The owner of this vault
    pub owner: AccountInfo<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tweet_url: String, market_id: String)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        seeds = [AGENT_EXECUTOR_SEED],
        bump = agent_executor.bump
    )]
    pub agent_executor: Account<'info, AgentExecutor>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeCred<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [REPUTATION_VAULT_SEED, user.key().as_ref()],
        bump = reputation_vault.bump
    )]
    pub reputation_vault: Account<'info, ReputationVault>,
    
    #[account(
        init,
        payer = user,
        space = 8 + CredStake::INIT_SPACE,
        seeds = [CRED_STAKE_SEED, market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub cred_stake: Account<'info, CredStake>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitEvidence<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [AGENT_EXECUTOR_SEED],
        bump = agent_executor.bump
    )]
    pub agent_executor: Account<'info, AgentExecutor>,
    
    /// The authority signer (must match agent_executor.authority)
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DistributeInsightRewards<'info> {
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [INSIGHT_POOL_SEED],
        bump = insight_pool.bump
    )]
    pub insight_pool: Account<'info, InsightPool>,
    
    #[account(
        seeds = [CRED_STAKE_SEED, market.key().as_ref(), recipient_vault.owner.as_ref()],
        bump = cred_stake.bump
    )]
    pub cred_stake: Account<'info, CredStake>,
    
    #[account(
        mut,
        seeds = [REPUTATION_VAULT_SEED, recipient_vault.owner.as_ref()],
        bump = recipient_vault.bump
    )]
    pub recipient_vault: Account<'info, ReputationVault>,
    
    #[account(
        seeds = [AGENT_EXECUTOR_SEED],
        bump = agent_executor.bump
    )]
    pub agent_executor: Account<'info, AgentExecutor>,
    
    /// The authority signer (must match agent_executor.authority)
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EarnCred<'info> {
    #[account(
        mut,
        seeds = [REPUTATION_VAULT_SEED, reputation_vault.owner.as_ref()],
        bump = reputation_vault.bump
    )]
    pub reputation_vault: Account<'info, ReputationVault>,
    
    #[account(
        seeds = [AGENT_EXECUTOR_SEED],
        bump = agent_executor.bump
    )]
    pub agent_executor: Account<'info, AgentExecutor>,
    
    /// The authority signer (must match agent_executor.authority)
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DisputeMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub disputer: Signer<'info>,
}

// ============================================================================
// STATE ACCOUNTS
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub creator: Pubkey,
    #[max_len(280)]
    pub tweet_url: String,
    #[max_len(32)]
    pub market_id: String,
    pub created_at: i64,
    pub status: MarketStatus,
    pub outcome: Option<u8>,
    pub ipfs_transcript_hash: [u8; 32],
    pub insight_pool_amount: u64,
    pub agent_executor: Pubkey,
    pub evidence_count: u8,
    pub total_yes_stake: u64,
    pub total_no_stake: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ReputationVault {
    pub owner: Pubkey,
    pub cred_balance: u64,
    pub total_earned: u64,
    pub total_staked: u64,
    pub participation_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct InsightPool {
    pub total_credits: u64,
    pub distributions_count: u64,
    pub last_distribution: i64,
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AgentExecutor {
    pub authority: Pubkey,
    pub markets_resolved: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CredStake {
    pub user: Pubkey,
    pub market: Pubkey,
    pub amount: u64,
    pub direction: bool,
    pub timestamp: i64,
    pub bump: u8,
}

// ============================================================================
// ENUMS
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MarketStatus {
    Open,
    Resolved,
    Disputed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum EarnMethod {
    InitialGrant,
    EvidenceSubmission,
    CorrectPrediction,
    Referral,
    IdentityVerification,
    CommunityContribution,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub tweet_url: String,
    pub market_id: String,
    pub timestamp: i64,
}

#[event]
pub struct CredStaked {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub direction: bool,
    pub timestamp: i64,
}

#[event]
pub struct EvidenceSubmitted {
    pub market: Pubkey,
    pub user: Pubkey,
    pub ipfs_cid: String,
    pub evidence_index: u8,
    pub timestamp: i64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub outcome: u8,
    pub ipfs_transcript_hash: [u8; 32],
    pub resolver: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct CredDistributed {
    pub market: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct CredEarned {
    pub user: Pubkey,
    pub amount: u64,
    pub method: EarnMethod,
    pub timestamp: i64,
}

#[event]
pub struct ProofNFTMintRequested {
    pub market: Pubkey,
    pub outcome: u8,
    pub ipfs_transcript_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct MarketDisputed {
    pub market: Pubkey,
    pub disputer: Pubkey,
    pub timestamp: i64,
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Tweet URL exceeds maximum length of 280 characters")]
    TweetUrlTooLong,
    
    #[msg("Market ID exceeds maximum length of 32 characters")]
    MarketIdTooLong,
    
    #[msg("IPFS CID exceeds maximum length")]
    IpfsCidTooLong,
    
    #[msg("Market is not open for participation")]
    MarketNotOpen,
    
    #[msg("Market has not been resolved yet")]
    MarketNotResolved,
    
    #[msg("Insufficient Cred balance")]
    InsufficientCred,
    
    #[msg("Invalid amount specified")]
    InvalidAmount,
    
    #[msg("Invalid outcome value (must be 0 or 1)")]
    InvalidOutcome,
    
    #[msg("Unauthorized resolver - only AgentExecutor authority can resolve")]
    UnauthorizedResolver,
    
    #[msg("Unauthorized minter - only AgentExecutor authority can mint Cred")]
    UnauthorizedMinter,
    
    #[msg("Too many evidence submissions for this market")]
    TooManyEvidenceSubmissions,
    
    #[msg("Arithmetic overflow")]
    Overflow,
    
    #[msg("User did not win this market")]
    UserDidNotWin,
}
