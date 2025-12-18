'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface SponsorFormData {
    companyName: string;
    email: string;
    bountyAmount: string;
    marketDescription: string;
}

export default function SponsorDashboard() {
    const [formData, setFormData] = useState<SponsorFormData>({
        companyName: '',
        email: '',
        bountyAmount: '',
        marketDescription: ''
    });
    const [submitted, setSubmitted] = useState(false);
    const [step, setStep] = useState(1);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock submission
        setSubmitted(true);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto"
        >
            <div className="glass-panel rounded-xl border border-amber-500/30 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-amber-900/20 to-orange-900/20">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🏢</span>
                        <div>
                            <h2 className="text-xl font-bold text-white">Sponsor Dashboard</h2>
                            <p className="text-sm text-gray-400">Create bounty markets for your brand</p>
                        </div>
                    </div>
                </div>

                {!submitted ? (
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* KYC Notice */}
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <p className="text-amber-400 font-medium">KYC Required</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        Sponsors must complete off-chain KYC verification before depositing funds.
                                        This form collects initial information for our team to contact you.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Company / Organization Name
                                </label>
                                <input
                                    type="text"
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors"
                                    placeholder="Acme Corporation"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Contact Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors"
                                    placeholder="sponsor@company.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Bounty Amount (USD equivalent)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        name="bountyAmount"
                                        value={formData.bountyAmount}
                                        onChange={handleChange}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors"
                                        placeholder="1,000"
                                        min="100"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Minimum $100 USD equivalent in SOL</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Market / Prediction Description
                                </label>
                                <textarea
                                    name="marketDescription"
                                    value={formData.marketDescription}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors resize-none"
                                    placeholder="Will our product launch exceed 10,000 signups by Q2 2025?"
                                    required
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold py-4 px-6 rounded-xl hover:scale-105 transition-transform"
                        >
                            Submit Sponsor Application
                        </button>

                        {/* Process Steps */}
                        <div className="border-t border-gray-800 pt-6 mt-6">
                            <p className="text-sm font-medium text-gray-400 mb-4">How it works:</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <div className="w-10 h-10 mx-auto rounded-full bg-gray-800 flex items-center justify-center text-amber-400 font-bold mb-2">1</div>
                                    <p className="text-xs text-gray-400">Submit application</p>
                                </div>
                                <div className="text-center">
                                    <div className="w-10 h-10 mx-auto rounded-full bg-gray-800 flex items-center justify-center text-amber-400 font-bold mb-2">2</div>
                                    <p className="text-xs text-gray-400">Complete KYC verification</p>
                                </div>
                                <div className="text-center">
                                    <div className="w-10 h-10 mx-auto rounded-full bg-gray-800 flex items-center justify-center text-amber-400 font-bold mb-2">3</div>
                                    <p className="text-xs text-gray-400">Deposit & launch market</p>
                                </div>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="p-6 text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-6xl mb-4"
                        >
                            ✅
                        </motion.div>
                        <h3 className="text-xl font-bold text-white mb-2">Application Submitted!</h3>
                        <p className="text-gray-400 mb-6">
                            Our team will contact you at <span className="text-amber-400">{formData.email}</span> within 24-48 hours to begin the KYC process.
                        </p>

                        <div className="bg-black/30 rounded-lg p-4 text-left">
                            <p className="text-sm font-medium text-gray-400 mb-2">Next Steps:</p>
                            <ul className="text-sm text-gray-500 space-y-1">
                                <li>• Check your email for verification link</li>
                                <li>• Prepare company documentation for KYC</li>
                                <li>• Set up a Solana wallet for deposits</li>
                            </ul>
                        </div>

                        <button
                            onClick={() => {
                                setSubmitted(false);
                                setFormData({ companyName: '', email: '', bountyAmount: '', marketDescription: '' });
                            }}
                            className="mt-6 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Submit Another Application
                        </button>
                    </div>
                )}

                {/* Footer disclaimer */}
                <div className="p-4 border-t border-gray-800 bg-black/30">
                    <p className="text-xs text-gray-500 text-center">
                        💼 Sponsor funds are held in escrow and distributed to accurate predictors by the AI Council.
                        Prophecy takes no fees from sponsor deposits.
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
