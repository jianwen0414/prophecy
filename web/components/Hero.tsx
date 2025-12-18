'use client';

import { motion } from 'framer-motion';

export default function Hero() {
    return (
        <section className="relative text-center py-16 px-4">
            {/* Animated badge */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full text-sm text-purple-400 mb-6"
            >
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Powered by AI Council on Solana
            </motion.div>

            {/* Main headline */}
            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-7xl font-bold text-white mb-6"
            >
                <span className="block">Predict.</span>
                <span className="block gradient-text">Verify.</span>
                <span className="block">Prove.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl text-gray-400 max-w-2xl mx-auto mb-8"
            >
                Transform any tweet into a prediction market.
                Our AI Council verifies outcomes autonomously.
                <span className="block text-sm text-gray-500 mt-2">
                    🔒 Non-monetary forecasting • No betting • Reputation only
                </span>
            </motion.p>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex justify-center gap-8 md:gap-16"
            >
                <div className="text-center">
                    <div className="text-3xl font-bold text-white">2.5M+</div>
                    <div className="text-sm text-gray-500">Cred Distributed</div>
                </div>
                <div className="text-center">
                    <div className="text-3xl font-bold text-white">1,247</div>
                    <div className="text-sm text-gray-500">Markets Resolved</div>
                </div>
                <div className="text-center">
                    <div className="text-3xl font-bold text-white">94.2%</div>
                    <div className="text-sm text-gray-500">Accuracy Rate</div>
                </div>
            </motion.div>

            {/* Decorative elements */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ duration: 1, delay: 0.5 }}
                className="absolute -z-10 top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-purple-500/20 to-transparent blur-3xl rounded-full"
            />
        </section>
    );
}
