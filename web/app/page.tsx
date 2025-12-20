'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Hero from '@/components/Hero';
import BlinkCreator from '@/components/BlinkCreator';
import WarRoom from '@/components/Terminal';
import WalletButton from '@/components/WalletButton';
import InsightPool from '@/components/InsightPool';
import Leaderboard from '@/components/Leaderboard';
import AgeGate from '@/components/AgeGate';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import QuickMarketCreator from '@/components/QuickMarketCreator';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'create' | 'pool' | 'leaderboard'>('create');

  return (
    <>
      {/* Age Gate */}
      <AgeGate onVerified={() => { }} />

      <main className="flex min-h-screen flex-col items-center justify-start relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-900/20 rounded-full blur-[100px] animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-900/10 rounded-full blur-[120px]" />
        </div>

        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/50 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔮</span>
              <span className="font-bold text-xl text-white">Prophecy</span>
              <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full ml-2">
                Beta
              </span>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={() => setActiveTab('create')}
                className={`text-sm transition-colors ${activeTab === 'create' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Create
              </button>
              <button
                onClick={() => setActiveTab('pool')}
                className={`text-sm transition-colors ${activeTab === 'pool' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Insight Pool
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`text-sm transition-colors ${activeTab === 'leaderboard' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Leaderboard
              </button>
            </div>

            <WalletButton />
          </div>
        </nav>

        {/* Main Content */}
        <div className="z-10 w-full max-w-6xl px-4 pt-24 pb-32">
          <Hero />

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-8"
          >
            {activeTab === 'create' && (
              <div className="space-y-12">
                {/* Quick Market Creator - One-Tap Feature */}
                <QuickMarketCreator />

                {/* Original Blink Creator */}
                <BlinkCreator />

                {/* War Room */}
                <div className="mt-12">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      🎭 The War Room
                    </h2>
                    <p className="text-gray-400 text-sm">
                      Watch the AI Council debate and resolve predictions in real-time
                    </p>
                  </div>
                  <WarRoom />
                </div>
              </div>
            )}

            {activeTab === 'pool' && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-2">
                    💎 AI-Managed Insight Liquidity
                  </h2>
                  <p className="text-gray-400">
                    Earn Cred rewards for accurate predictions
                  </p>
                </div>
                <InsightPool />

                <div className="mt-12 text-center">
                  <h3 className="text-xl font-bold text-white mb-4">How It Works</h3>
                  <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                    <div className="glass-panel rounded-xl p-6">
                      <div className="text-3xl mb-3">🎯</div>
                      <h4 className="font-bold text-white mb-2">Make Predictions</h4>
                      <p className="text-sm text-gray-400">Stake your Cred on market outcomes</p>
                    </div>
                    <div className="glass-panel rounded-xl p-6">
                      <div className="text-3xl mb-3">🤖</div>
                      <h4 className="font-bold text-white mb-2">AI Verification</h4>
                      <p className="text-sm text-gray-400">Council verifies truth on-chain</p>
                    </div>
                    <div className="glass-panel rounded-xl p-6">
                      <div className="text-3xl mb-3">💰</div>
                      <h4 className="font-bold text-white mb-2">Earn Rewards</h4>
                      <p className="text-sm text-gray-400">Accurate predictors earn Cred</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-2">
                    🏆 Top Predictors
                  </h2>
                  <p className="text-gray-400">
                    See who&apos;s leading the forecasting game
                  </p>
                </div>
                <Leaderboard />
              </div>
            )}
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="fixed bottom-20 left-0 right-0 z-30 text-center py-4">
          <p className="text-xs text-gray-600">
            Built with ❤️ on Solana • Powered by AI Council
          </p>
        </footer>

        {/* Disclaimer Banner */}
        <DisclaimerBanner />
      </main>
    </>
  );
}
