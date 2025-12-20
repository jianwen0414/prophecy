const anchor = require("@coral-xyz/anchor");
const { Program } = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { expect } = require("chai");

describe("prophecy", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Prophecy;

  // Test keypairs
  const agentExecutorAuthority = Keypair.generate();
  const marketCreator = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();
  const sponsor = Keypair.generate();

  // PDAs
  let insightPoolPda;
  let insightPoolBump;
  let agentExecutorPda;
  let agentExecutorBump;

  // Use short market IDs to avoid PDA length issues
  const marketId = "mkt001";
  const tweetUrl = "https://x.com/test/status/123";

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropAmount = 10 * LAMPORTS_PER_SOL;

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(agentExecutorAuthority.publicKey, airdropAmount)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(marketCreator.publicKey, airdropAmount)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, airdropAmount)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user2.publicKey, airdropAmount)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(sponsor.publicKey, airdropAmount)
    );

    // Derive PDAs
    [insightPoolPda, insightPoolBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("insight_pool")],
      program.programId
    );

    [agentExecutorPda, agentExecutorBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent_executor")],
      program.programId
    );
  });

  describe("Initialization", () => {
    it("Initializes the Insight Pool", async () => {
      await program.methods
        .initializeInsightPool()
        .accounts({
          insightPool: insightPoolPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const insightPool = await program.account.insightPool.fetch(insightPoolPda);
      expect(insightPool.authority.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
      expect(insightPool.totalCredits.toNumber()).to.equal(0);
      expect(insightPool.distributionsCount.toNumber()).to.equal(0);
    });

    it("Initializes the Agent Executor", async () => {
      await program.methods
        .initializeAgentExecutor()
        .accounts({
          agentExecutor: agentExecutorPda,
          authority: agentExecutorAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentExecutorAuthority])
        .rpc();

      const agentExecutor = await program.account.agentExecutor.fetch(agentExecutorPda);
      expect(agentExecutor.authority.toBase58()).to.equal(agentExecutorAuthority.publicKey.toBase58());
      expect(agentExecutor.marketsResolved.toNumber()).to.equal(0);
    });
  });

  describe("Reputation Vault", () => {
    let user1VaultPda;

    before(async () => {
      [user1VaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation_vault"), user1.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Initializes a user's Reputation Vault with initial Cred", async () => {
      // Note: owner and payer are separate - payer pays for account creation
      await program.methods
        .initializeReputationVault()
        .accounts({
          reputationVault: user1VaultPda,
          owner: user1.publicKey,
          payer: provider.wallet.publicKey, // Provider wallet pays
          systemProgram: SystemProgram.programId,
        })
        .rpc(); // No extra signers needed - provider wallet signs

      const vault = await program.account.reputationVault.fetch(user1VaultPda);
      expect(vault.owner.toBase58()).to.equal(user1.publicKey.toBase58());
      expect(vault.credBalance.toNumber()).to.equal(100_000_000); // 100 Cred (6 decimals)
      expect(vault.totalEarned.toNumber()).to.equal(100_000_000);
      expect(vault.participationCount.toNumber()).to.equal(0);
    });

    it("Cannot initialize vault twice for same user", async () => {
      try {
        await program.methods
          .initializeReputationVault()
          .accounts({
            reputationVault: user1VaultPda,
            owner: user1.publicKey,
            payer: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.include("already in use");
      }
    });
  });

  describe("Market Creation", () => {
    let marketPda;

    before(async () => {
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), Buffer.from(marketId)],
        program.programId
      );
    });

    it("Creates a new market", async () => {
      // Note: instruction params are (tweet_url, market_id, sponsor)
      await program.methods
        .initializeMarket(tweetUrl, marketId, null)
        .accounts({
          market: marketPda,
          agentExecutor: agentExecutorPda,
          creator: marketCreator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      const market = await program.account.market.fetch(marketPda);
      expect(market.marketId).to.equal(marketId);
      expect(market.tweetUrl).to.equal(tweetUrl);
      expect(market.creator.toBase58()).to.equal(marketCreator.publicKey.toBase58());
      expect(market.status).to.deep.equal({ open: {} });
      expect(market.outcome).to.be.null;
    });

    it("Rejects tweet URL that is too long", async () => {
      const longUrl = "https://x.com/test/status/" + "x".repeat(300);
      const longMktId = "mkt002";
      const [longMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), Buffer.from(longMktId)],
        program.programId
      );

      try {
        await program.methods
          .initializeMarket(longUrl, longMktId, null)
          .accounts({
            market: longMarketPda,
            agentExecutor: agentExecutorPda,
            creator: marketCreator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([marketCreator])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.include("TweetUrlTooLong");
      }
    });
  });

  describe("Cred Staking", () => {
    let marketPda;
    let user1VaultPda;
    let credStakePda;

    before(async () => {
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), Buffer.from(marketId)],
        program.programId
      );
      [user1VaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation_vault"), user1.publicKey.toBuffer()],
        program.programId
      );
      [credStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("cred_stake"), marketPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Stakes Cred on a market", async () => {
      const stakeAmount = new anchor.BN(50_000_000); // 50 Cred

      await program.methods
        .stakeCred(true, stakeAmount) // Stake on YES
        .accounts({
          market: marketPda,
          reputationVault: user1VaultPda,
          credStake: credStakePda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const vault = await program.account.reputationVault.fetch(user1VaultPda);
      expect(vault.credBalance.toNumber()).to.equal(50_000_000); // 100 - 50 = 50
      expect(vault.totalStaked.toNumber()).to.equal(50_000_000);
      expect(vault.participationCount.toNumber()).to.equal(1);

      const stake = await program.account.credStake.fetch(credStakePda);
      expect(stake.amount.toNumber()).to.equal(50_000_000);
      expect(stake.direction).to.equal(true); // YES

      const market = await program.account.market.fetch(marketPda);
      expect(market.totalYesStake.toNumber()).to.equal(50_000_000);
    });

    it("Rejects stake with insufficient Cred", async () => {
      const [user2VaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation_vault"), user2.publicKey.toBuffer()],
        program.programId
      );

      // Initialize user2 vault first (with provider as payer)
      await program.methods
        .initializeReputationVault()
        .accounts({
          reputationVault: user2VaultPda,
          owner: user2.publicKey,
          payer: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const [user2StakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("cred_stake"), marketPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      const hugeStake = new anchor.BN(1_000_000_000_000); // Way more than available

      try {
        await program.methods
          .stakeCred(false, hugeStake)
          .accounts({
            market: marketPda,
            reputationVault: user2VaultPda,
            credStake: user2StakePda,
            user: user2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user2])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.include("InsufficientCred");
      }
    });
  });

  describe("Evidence Submission", () => {
    let marketPda;

    before(async () => {
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), Buffer.from(marketId)],
        program.programId
      );
    });

    it("Submits evidence with IPFS CID", async () => {
      const ipfsCid = "bafkreiexamplecid123456789abc";

      await program.methods
        .submitEvidence(ipfsCid)
        .accounts({
          market: marketPda,
          user: user1.publicKey,
        })
        .signers([user1])
        .rpc();

      const market = await program.account.market.fetch(marketPda);
      expect(market.evidenceCount).to.equal(1);
    });
  });

  describe("Market Resolution", () => {
    let marketPda;

    before(async () => {
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), Buffer.from(marketId)],
        program.programId
      );
    });

    it("Rejects resolution from unauthorized account", async () => {
      const ipfsHash = new Array(32).fill(0); // Dummy hash

      try {
        await program.methods
          .resolveMarket(1, ipfsHash) // Try to resolve as YES
          .accounts({
            market: marketPda,
            agentExecutor: agentExecutorPda,
            authority: user1.publicKey, // Wrong authority
          })
          .signers([user1])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.include("Unauthorized");
      }
    });

    it("Resolves market as agent executor", async () => {
      const ipfsHash = new Array(32).fill(42); // Mock hash

      await program.methods
        .resolveMarket(1, ipfsHash) // Resolve as YES
        .accounts({
          market: marketPda,
          agentExecutor: agentExecutorPda,
          authority: agentExecutorAuthority.publicKey,
        })
        .signers([agentExecutorAuthority])
        .rpc();

      const market = await program.account.market.fetch(marketPda);
      expect(market.status).to.deep.equal({ resolved: {} });
      expect(market.outcome).to.equal(1); // YES

      const agentExecutor = await program.account.agentExecutor.fetch(agentExecutorPda);
      expect(agentExecutor.marketsResolved.toNumber()).to.equal(1);
    });

    it("Cannot resolve already resolved market", async () => {
      const ipfsHash = new Array(32).fill(0);

      try {
        await program.methods
          .resolveMarket(0, ipfsHash)
          .accounts({
            market: marketPda,
            agentExecutor: agentExecutorPda,
            authority: agentExecutorAuthority.publicKey,
          })
          .signers([agentExecutorAuthority])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.include("MarketNotOpen");
      }
    });
  });

  describe("Sponsor Escrow (Mock)", () => {
    const sponsoredMarketId = "spmkt01";
    let sponsoredMarketPda;
    let escrowPda;

    before(async () => {
      [sponsoredMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), Buffer.from(sponsoredMarketId)],
        program.programId
      );
      [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("sponsor_escrow"), sponsoredMarketPda.toBuffer()],
        program.programId
      );

      // Create sponsored market (note param order: tweet_url, market_id, sponsor)
      await program.methods
        .initializeMarket(tweetUrl, sponsoredMarketId, sponsor.publicKey)
        .accounts({
          market: sponsoredMarketPda,
          agentExecutor: agentExecutorPda,
          creator: marketCreator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();
    });

    it("Initializes sponsor escrow", async () => {
      const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      await program.methods
        .initializeSponsorEscrow(depositAmount)
        .accounts({
          escrow: escrowPda,
          market: sponsoredMarketPda,
          sponsor: sponsor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([sponsor])
        .rpc();

      const escrow = await program.account.sponsorEscrow.fetch(escrowPda);
      expect(escrow.sponsor.toBase58()).to.equal(sponsor.publicKey.toBase58());
      expect(escrow.amount.toNumber()).to.equal(LAMPORTS_PER_SOL);
      expect(escrow.isReleased).to.equal(false);
    });
  });

  describe("Cred Earning", () => {
    let user1VaultPda;

    before(async () => {
      [user1VaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation_vault"), user1.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Earns Cred via agent executor", async () => {
      const earnAmount = new anchor.BN(25_000_000); // 25 Cred

      const vaultBefore = await program.account.reputationVault.fetch(user1VaultPda);
      const balanceBefore = vaultBefore.credBalance.toNumber();

      await program.methods
        .earnCred(earnAmount, { correctPrediction: {} }) // EarnMethod enum
        .accounts({
          reputationVault: user1VaultPda,
          agentExecutor: agentExecutorPda,
          authority: agentExecutorAuthority.publicKey,
        })
        .signers([agentExecutorAuthority])
        .rpc();

      const vaultAfter = await program.account.reputationVault.fetch(user1VaultPda);
      expect(vaultAfter.credBalance.toNumber()).to.equal(balanceBefore + 25_000_000);
    });
  });

  describe("Market Dispute", () => {
    const disputeMarketId = "dmkt01";
    let disputeMarketPda;

    before(async () => {
      [disputeMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), Buffer.from(disputeMarketId)],
        program.programId
      );

      // Create and resolve a market to dispute
      await program.methods
        .initializeMarket(tweetUrl, disputeMarketId, null)
        .accounts({
          market: disputeMarketPda,
          agentExecutor: agentExecutorPda,
          creator: marketCreator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      const ipfsHash = new Array(32).fill(1);
      await program.methods
        .resolveMarket(1, ipfsHash)
        .accounts({
          market: disputeMarketPda,
          agentExecutor: agentExecutorPda,
          authority: agentExecutorAuthority.publicKey,
        })
        .signers([agentExecutorAuthority])
        .rpc();
    });

    it("Disputes a resolved market", async () => {
      await program.methods
        .disputeMarket()
        .accounts({
          market: disputeMarketPda,
          disputer: user1.publicKey,
        })
        .signers([user1])
        .rpc();

      const market = await program.account.market.fetch(disputeMarketPda);
      expect(market.status).to.deep.equal({ disputed: {} });
    });
  });

  describe("Oracle Stakes", () => {
    const oracleMarketId = "omkt01";
    let oracleMarketPda;
    let user1OracleStakePda;

    before(async () => {
      [oracleMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), Buffer.from(oracleMarketId)],
        program.programId
      );
      [user1OracleStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("oracle_stake"), oracleMarketPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      // Need user1 vault (already exists from previous test)
      const [user1VaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation_vault"), user1.publicKey.toBuffer()],
        program.programId
      );

      // Create a new market for oracle stake testing
      await program.methods
        .initializeMarket(tweetUrl, oracleMarketId, null)
        .accounts({
          market: oracleMarketPda,
          agentExecutor: agentExecutorPda,
          creator: marketCreator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();
    });

    it("Stakes on oracle for a market", async () => {
      const [user1VaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation_vault"), user1.publicKey.toBuffer()],
        program.programId
      );

      const stakeAmount = new anchor.BN(10_000_000); // 10 Cred

      const vaultBefore = await program.account.reputationVault.fetch(user1VaultPda);
      const balanceBefore = vaultBefore.credBalance.toNumber();

      await program.methods
        .stakeOnOracle(stakeAmount)
        .accounts({
          market: oracleMarketPda,
          reputationVault: user1VaultPda,
          oracleStake: user1OracleStakePda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const vaultAfter = await program.account.reputationVault.fetch(user1VaultPda);
      expect(vaultAfter.credBalance.toNumber()).to.equal(balanceBefore - 10_000_000);

      const oracleStake = await program.account.oracleStake.fetch(user1OracleStakePda);
      expect(oracleStake.amount.toNumber()).to.equal(10_000_000);
      expect(oracleStake.claimed).to.equal(false);
      expect(oracleStake.user.toBase58()).to.equal(user1.publicKey.toBase58());
    });

    it("Rejects oracle stake on resolved market", async () => {
      // Resolve the market first
      const ipfsHash = new Array(32).fill(99);
      await program.methods
        .resolveMarket(1, ipfsHash)
        .accounts({
          market: oracleMarketPda,
          agentExecutor: agentExecutorPda,
          authority: agentExecutorAuthority.publicKey,
        })
        .signers([agentExecutorAuthority])
        .rpc();

      // Try to stake on resolved market with user2
      const [user2VaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation_vault"), user2.publicKey.toBuffer()],
        program.programId
      );
      const [user2OracleStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("oracle_stake"), oracleMarketPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .stakeOnOracle(new anchor.BN(10_000_000))
          .accounts({
            market: oracleMarketPda,
            reputationVault: user2VaultPda,
            oracleStake: user2OracleStakePda,
            user: user2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user2])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.include("MarketNotOpen");
      }
    });

    it("Resolves oracle stakes after market resolution", async () => {
      const [user1VaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation_vault"), user1.publicKey.toBuffer()],
        program.programId
      );

      const vaultBefore = await program.account.reputationVault.fetch(user1VaultPda);
      const balanceBefore = vaultBefore.credBalance.toNumber();

      // Market was resolved without dispute, so oracle staker wins 2x
      await program.methods
        .resolveOracleStake(false) // market was NOT disputed
        .accounts({
          market: oracleMarketPda,
          oracleStake: user1OracleStakePda,
          reputationVault: user1VaultPda,
          agentExecutor: agentExecutorPda,
          authority: agentExecutorAuthority.publicKey,
        })
        .signers([agentExecutorAuthority])
        .rpc();

      const vaultAfter = await program.account.reputationVault.fetch(user1VaultPda);
      // Should have received 2x stake (20 Cred)
      expect(vaultAfter.credBalance.toNumber()).to.equal(balanceBefore + 20_000_000);

      const oracleStake = await program.account.oracleStake.fetch(user1OracleStakePda);
      expect(oracleStake.claimed).to.equal(true);
    });
  });
});
