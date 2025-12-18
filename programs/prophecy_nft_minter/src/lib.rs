use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, CreateMasterEditionV3,
        CreateMetadataAccountsV3, Metadata, MetadataAccount,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

declare_id!("5XF89XNFqGSWkzYa6AqYtnA4d2WcdNYYABKzsi9UwKfb");

// ============================================================================
// CONSTANTS
// ============================================================================

pub const MINTER_CONFIG_SEED: &[u8] = b"minter_config";

// ============================================================================
// PROGRAM
// ============================================================================

#[program]
pub mod prophecy_nft_minter {
    use anchor_spl::metadata::mpl_token_metadata::types::DataV2;

    use super::*;

    /// Initialize the minter configuration
    pub fn initialize_minter(ctx: Context<InitializeMinter>) -> Result<()> {
        let config = &mut ctx.accounts.minter_config;
        config.authority = ctx.accounts.authority.key();
        config.mints_count = 0;
        config.bump = ctx.bumps.minter_config;

        msg!("MinterConfig initialized with authority: {}", config.authority);
        Ok(())
    }

    /// Mint a Proof-Of-Truth NFT
    /// Only callable by the authorized minter (agent executor)
    pub fn mint_proof_nft(
        ctx: Context<MintProofNFT>,
        name: String,
        symbol: String,
        uri: String,
        market_id: String,
        outcome: u8,
    ) -> Result<()> {
        let config = &mut ctx.accounts.minter_config;

        // Verify authority
        require!(
            ctx.accounts.authority.key() == config.authority,
            ErrorCode::UnauthorizedMinter
        );

        // Mint the NFT token (1 token)
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            1,
        )?;

        // Create metadata
        let data = DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            seller_fee_basis_points: 0,
            creators: Some(vec![anchor_spl::metadata::mpl_token_metadata::types::Creator {
                address: ctx.accounts.authority.key(),
                verified: true,
                share: 100,
            }]),
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    mint_authority: ctx.accounts.authority.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    update_authority: ctx.accounts.authority.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            data,
            true,  // is_mutable
            true,  // update_authority_is_signer
            None,  // collection_details
        )?;

        // Create master edition (makes it a true NFT - supply of 1)
        create_master_edition_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    update_authority: ctx.accounts.authority.to_account_info(),
                    mint_authority: ctx.accounts.authority.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    metadata: ctx.accounts.metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            Some(0), // max_supply = 0 means unique
        )?;

        // Update config
        config.mints_count = config.mints_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        emit!(ProofNFTMinted {
            mint: ctx.accounts.mint.key(),
            recipient: ctx.accounts.recipient.key(),
            market_id,
            outcome,
            metadata_uri: uri,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Proof-Of-Truth NFT minted: {}", ctx.accounts.mint.key());
        Ok(())
    }

    /// Update minter authority (for admin purposes)
    pub fn update_minter_authority(
        ctx: Context<UpdateMinterAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.minter_config;

        require!(
            ctx.accounts.authority.key() == config.authority,
            ErrorCode::UnauthorizedMinter
        );

        config.authority = new_authority;

        msg!("MinterConfig authority updated to: {}", new_authority);
        Ok(())
    }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

#[derive(Accounts)]
pub struct InitializeMinter<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MinterConfig::INIT_SPACE,
        seeds = [MINTER_CONFIG_SEED],
        bump
    )]
    pub minter_config: Account<'info, MinterConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String, market_id: String)]
pub struct MintProofNFT<'info> {
    #[account(
        mut,
        seeds = [MINTER_CONFIG_SEED],
        bump = minter_config.bump
    )]
    pub minter_config: Account<'info, MinterConfig>,

    /// The NFT mint account
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = authority,
        mint::freeze_authority = authority,
    )]
    pub mint: Account<'info, Mint>,

    /// The token account to receive the NFT
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = recipient,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: Metadata account (created by Metaplex CPI)
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Master edition account (created by Metaplex CPI)
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    /// The recipient of the NFT
    /// CHECK: Can be any account
    pub recipient: AccountInfo<'info>,

    /// The authority (must match minter_config.authority)
    pub authority: Signer<'info>,

    /// The payer for account creation
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateMinterAuthority<'info> {
    #[account(
        mut,
        seeds = [MINTER_CONFIG_SEED],
        bump = minter_config.bump
    )]
    pub minter_config: Account<'info, MinterConfig>,

    pub authority: Signer<'info>,
}

// ============================================================================
// STATE ACCOUNTS
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct MinterConfig {
    pub authority: Pubkey,
    pub mints_count: u64,
    pub bump: u8,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event]
pub struct ProofNFTMinted {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub market_id: String,
    pub outcome: u8,
    pub metadata_uri: String,
    pub timestamp: i64,
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized minter - only the configured authority can mint")]
    UnauthorizedMinter,

    #[msg("Arithmetic overflow")]
    Overflow,
}
