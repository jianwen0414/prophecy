'use client';

import Link from 'next/link';
import SponsorDashboard from '@/components/SponsorDashboard';
import WalletButton from '@/components/WalletButton';
import { motion } from 'framer-motion';

export default function SponsorPage() {
    return (
        <main className="min-h-screen relative overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-900/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-orange-900/20 rounded-full blur-[100px]" />
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/50 border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-2xl">🔮</span>
                        <span className="font-bold text-xl text-white">Prophecy</span>
                    </Link>
                    <WalletButton />
                </div>
            </nav>

            <div className="z-10 relative max-w-4xl mx-auto px-4 pt-24 pb-12">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-4xl font-bold text-white mb-4">
                        Become a <span className="gradient-text">Prophecy Sponsor</span>
                    </h1>
                    <p className="text-gray-400 max-w-xl mx-auto">
                        Fund bounty markets and reward accurate predictors.
                        Perfect for brands, projects, and organizations looking to
                        leverage crowd wisdom for forecasting.
                    </p>
                </motion.div>

                {/* Benefits */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid md:grid-cols-3 gap-6 mb-12"
                >
                    <div className="glass-panel rounded-xl p-6 text-center">
                        <div className="text-3xl mb-3">🎯</div>
                        <h3 className="font-bold text-white mb-2">Crowd Intelligence</h3>
                        <p className="text-sm text-gray-400">
                            Tap into collective forecasting power for accurate predictions
                        </p>
                    </div>
                    <div className="glass-panel rounded-xl p-6 text-center">
                        <div className="text-3xl mb-3">📢</div>
                        <h3 className="font-bold text-white mb-2">Brand Visibility</h3>
                        <p className="text-sm text-gray-400">
                            Your markets become shareable Blinks across social media
                        </p>
                    </div>
                    <div className="glass-panel rounded-xl p-6 text-center">
                        <div className="text-3xl mb-3">🤖</div>
                        <h3 className="font-bold text-white mb-2">AI Verified</h3>
                        <p className="text-sm text-gray-400">
                            Outcomes verified by our transparent AI Council
                        </p>
                    </div>
                </motion.div>

                {/* Dashboard */}
                <SponsorDashboard />

                {/* FAQ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-12"
                >
                    <h2 className="text-xl font-bold text-white mb-6 text-center">
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                        <div className="glass-panel rounded-xl p-4">
                            <h4 className="font-medium text-white mb-2">Why is KYC required?</h4>
                            <p className="text-sm text-gray-400">
                                Sponsors deposit real funds (SOL) which are distributed to winners.
                                KYC ensures compliance with financial regulations and prevents fraud.
                            </p>
                        </div>
                        <div className="glass-panel rounded-xl p-4">
                            <h4 className="font-medium text-white mb-2">What happens to my deposit?</h4>
                            <p className="text-sm text-gray-400">
                                Funds are held in a secure escrow until market resolution.
                                The AI Council then distributes rewards to accurate predictors.
                            </p>
                        </div>
                        <div className="glass-panel rounded-xl p-4">
                            <h4 className="font-medium text-white mb-2">Can I get a refund?</h4>
                            <p className="text-sm text-gray-400">
                                Deposited funds are non-refundable once the market is live.
                                Contact us before launch if you need to cancel.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
