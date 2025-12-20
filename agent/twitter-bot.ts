/**
 * Prophecy Twitter Bot - One-Tap Blink Markets via Twitter Mentions
 * 
 * Listens for "@ProphecyMarket create market" mentions and automatically
 * creates a prediction market from the parent tweet.
 */

import { TwitterApi } from 'twitter-api-v2';

// Credentials are read lazily to ensure dotenv has loaded
const getTwitterCredentials = () => ({
    TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN || '',
    TWITTER_API_KEY: process.env.TWITTER_API_KEY || '',
    TWITTER_API_SECRET: process.env.TWITTER_API_SECRET || '',
    TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN || '',
    TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET || '',
});

const BASE_URL = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://prophecy-two.vercel.app';

interface CreateMarketResult {
    success: boolean;
    marketId?: string;
    blinkUrl?: string;
    shareableBlinkUrl?: string;
    error?: string;
}

interface MentionData {
    tweetId: string;
    authorId: string;
    authorUsername: string;
    parentTweetId?: string;
    parentTweetUrl?: string;
    text: string;
}

export class ProphecyTwitterBot {
    private client: TwitterApi | null = null;
    private isListening = false;
    private lastMentionId: string | null = null;
    private checkInterval: NodeJS.Timeout | null = null;
    private createMarketFn: ((tweetUrl: string) => Promise<CreateMarketResult>) | null = null;
    private initialized = false;

    constructor() {
        // Don't initialize in constructor - wait for first use
    }

    /**
     * Initialize Twitter API client (called lazily on first use)
     */
    private ensureInitialized() {
        if (this.initialized) return;
        this.initialized = true;

        const creds = getTwitterCredentials();

        if (!creds.TWITTER_API_KEY || !creds.TWITTER_API_SECRET) {
            console.warn('⚠️ Twitter API credentials not configured. Bot will not start.');
            console.warn('   Set TWITTER_API_KEY and TWITTER_API_SECRET in .env');
            return;
        }

        try {
            this.client = new TwitterApi({
                appKey: creds.TWITTER_API_KEY,
                appSecret: creds.TWITTER_API_SECRET,
                accessToken: creds.TWITTER_ACCESS_TOKEN || undefined,
                accessSecret: creds.TWITTER_ACCESS_SECRET || undefined,
            });

            console.log('🐦 Twitter bot initialized');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to initialize Twitter client:', errorMessage);
        }
    }

    /**
     * Set the function to create markets (injected from graph.ts)
     */
    setMarketCreator(fn: (tweetUrl: string) => Promise<CreateMarketResult>) {
        this.createMarketFn = fn;
    }

    /**
     * Start listening for mentions
     */
    async startListening() {
        this.ensureInitialized();

        if (!this.client) {
            console.warn('🐦 Twitter bot not initialized - skipping mention listener');
            return;
        }

        if (this.isListening) {
            console.log('🐦 Bot is already listening');
            return;
        }

        this.isListening = true;
        console.log('🐦 Twitter bot started listening for mentions');

        // Check mentions every 30 seconds (to respect rate limits)
        this.checkInterval = setInterval(() => {
            this.checkMentions();
        }, 30000);

        // Initial check
        await this.checkMentions();
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isListening = false;
        console.log('🐦 Twitter bot stopped');
    }

    /**
     * Check for new mentions
     */
    private async checkMentions() {
        if (!this.client) return;

        try {
            // Get authenticated user's ID
            const me = await this.client.v2.me();
            const userId = me.data.id;

            // Get recent mentions
            const mentions = await this.client.v2.userMentionTimeline(userId, {
                since_id: this.lastMentionId || undefined,
                max_results: 10,
                'tweet.fields': ['in_reply_to_user_id', 'referenced_tweets', 'conversation_id'],
                expansions: ['referenced_tweets.id', 'author_id'],
            });

            if (!mentions.data.data?.length) {
                return;
            }

            // Update last mention ID
            this.lastMentionId = mentions.data.data[0].id;

            // Process each mention
            for (const mention of mentions.data.data) {
                await this.processMention(mention);
            }
        } catch (err: any) {
            console.error('🐦 Error checking mentions:', err.message);
        }
    }

    /**
     * Process a single mention
     */
    private async processMention(mention: any) {
        const text = mention.text.toLowerCase();

        // Check if this is a "create market" request
        if (!text.includes('create market') && !text.includes('predict this')) {
            return;
        }

        console.log(`🐦 Processing mention: ${mention.id}`);

        // Find parent tweet (the tweet being replied to)
        let parentTweetId: string | null = null;
        if (mention.referenced_tweets) {
            const replyTo = mention.referenced_tweets.find(
                (ref: any) => ref.type === 'replied_to'
            );
            if (replyTo) {
                parentTweetId = replyTo.id;
            }
        }

        if (!parentTweetId) {
            console.log('   No parent tweet found, skipping');
            return;
        }

        // Get parent tweet details
        try {
            const parentTweet = await this.client!.v2.singleTweet(parentTweetId, {
                'tweet.fields': ['author_id'],
                expansions: ['author_id'],
            });

            const authorUsername = parentTweet.includes?.users?.[0]?.username || 'unknown';
            const tweetUrl = `https://x.com/${authorUsername}/status/${parentTweetId}`;

            console.log(`   Parent tweet URL: ${tweetUrl}`);

            // Create market
            if (!this.createMarketFn) {
                console.warn('   Market creator function not set');
                return;
            }

            const result = await this.createMarketFn(tweetUrl);

            if (result.success && result.shareableBlinkUrl) {
                // Reply with the Blink URL
                await this.replyWithBlink(mention.id, result.shareableBlinkUrl);
            } else {
                console.error(`   Failed to create market: ${result.error}`);
            }
        } catch (err: any) {
            console.error(`   Error processing parent tweet: ${err.message}`);
        }
    }

    /**
     * Reply to a tweet with the Blink URL
     */
    private async replyWithBlink(tweetId: string, blinkUrl: string) {
        if (!this.client) return;

        try {
            const replyText = `🔮 Prophecy market created! Make your prediction:\n\n${blinkUrl}`;

            await this.client.v2.reply(replyText, tweetId);
            console.log(`   ✅ Replied to tweet ${tweetId} with Blink URL`);
        } catch (err: any) {
            console.error(`   Failed to reply: ${err.message}`);
        }
    }

    /**
     * Manually create a market from a tweet URL (for API use)
     */
    async createMarketFromTweet(tweetUrl: string): Promise<CreateMarketResult> {
        // Validate URL
        const match = tweetUrl.match(/^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
        if (!match) {
            return { success: false, error: 'Invalid tweet URL' };
        }

        const tweetId = match[2];
        const marketId = `tw_${tweetId.slice(-8)}_${Date.now().toString(36).slice(-4)}`;

        // Generate Blink URL
        const blinkUrl = `${BASE_URL}/api/actions/bet/${marketId}`;
        const shareableBlinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(blinkUrl)}`;

        return {
            success: true,
            marketId,
            blinkUrl,
            shareableBlinkUrl,
        };
    }

    /**
     * Check if bot is configured
     */
    isConfigured(): boolean {
        return this.client !== null;
    }

    /**
     * Fetch tweet content from a tweet URL
     * Returns the actual text of the tweet
     */
    async fetchTweetContent(tweetUrl: string): Promise<{ success: boolean; text?: string; author?: string; error?: string }> {
        this.ensureInitialized();

        if (!this.client) {
            return { success: false, error: 'Twitter API not configured' };
        }

        // Extract tweet ID from URL
        const match = tweetUrl.match(/^https?:\/\/(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
        if (!match) {
            return { success: false, error: 'Invalid tweet URL format' };
        }

        const tweetId = match[3];

        try {
            const tweet = await this.client.v2.singleTweet(tweetId, {
                'tweet.fields': ['text', 'created_at', 'public_metrics'],
                expansions: ['author_id'],
                'user.fields': ['username', 'name'],
            });

            if (!tweet.data) {
                return { success: false, error: 'Tweet not found' };
            }

            const authorInfo = tweet.includes?.users?.[0];
            const author = authorInfo ? `@${authorInfo.username} (${authorInfo.name})` : 'Unknown';

            return {
                success: true,
                text: tweet.data.text,
                author,
            };
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to fetch tweet:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }
}

// Export singleton instance
export const twitterBot = new ProphecyTwitterBot();

// Export function to start bot (called from main)
export function startTwitterBot(createMarketFn: (tweetUrl: string) => Promise<CreateMarketResult>) {
    twitterBot.setMarketCreator(createMarketFn);
    twitterBot.startListening();
}

// Export function to fetch tweet content
export async function fetchTweetContent(tweetUrl: string) {
    return twitterBot.fetchTweetContent(tweetUrl);
}
