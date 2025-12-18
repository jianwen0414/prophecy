'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface AgeGateProps {
    onVerified?: () => void;
}

export default function AgeGate({ onVerified }: AgeGateProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        // Check if already verified
        const isVerified = localStorage.getItem('prophecy_age_verified') === 'true';
        if (!isVerified) {
            setIsOpen(true);
        } else {
            setVerified(true);
            onVerified?.();
        }
    }, [onVerified]);

    const handleVerify = () => {
        localStorage.setItem('prophecy_age_verified', 'true');
        setVerified(true);
        setIsOpen(false);
        onVerified?.();
    };

    const handleDecline = () => {
        window.location.href = 'https://www.google.com';
    };

    if (!isOpen || verified) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-lg"
                >
                    <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
                        {/* Logo */}
                        <div className="text-6xl mb-4">🔮</div>

                        <h1 className="text-2xl font-bold text-white mb-2">
                            Welcome to Prophecy
                        </h1>

                        <p className="text-gray-400 mb-6">
                            Before you continue, please confirm the following:
                        </p>

                        {/* Verification items */}
                        <div className="text-left space-y-4 mb-8 bg-black/30 p-4 rounded-xl">
                            <div className="flex items-start gap-3">
                                <span className="text-green-400 mt-1">✓</span>
                                <div>
                                    <p className="text-white font-medium">I am 18 years or older</p>
                                    <p className="text-xs text-gray-500">Age requirement for forecasting platforms</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <span className="text-green-400 mt-1">✓</span>
                                <div>
                                    <p className="text-white font-medium">I understand this is NOT gambling</p>
                                    <p className="text-xs text-gray-500">Prophecy is a forecasting and verification platform</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <span className="text-green-400 mt-1">✓</span>
                                <div>
                                    <p className="text-white font-medium">Users do not wager real money</p>
                                    <p className="text-xs text-gray-500">Participation uses non-monetary Cred tokens</p>
                                </div>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-4">
                            <button
                                onClick={handleDecline}
                                className="flex-1 py-3 px-6 border border-gray-700 text-gray-400 rounded-xl hover:bg-gray-800 transition-colors"
                            >
                                Exit
                            </button>
                            <button
                                onClick={handleVerify}
                                className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:scale-105 transition-transform"
                            >
                                I Confirm & Continue
                            </button>
                        </div>

                        <p className="text-xs text-gray-600 mt-6">
                            By continuing, you agree to our Terms of Service and Privacy Policy.
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
