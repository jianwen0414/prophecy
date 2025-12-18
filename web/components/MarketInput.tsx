"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface MarketInputProps {
    onSubmit: (question: string) => void;
    isLoading: boolean;
}

export default function MarketInput({ onSubmit, isLoading }: MarketInputProps) {
    const [question, setQuestion] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (question.trim()) {
            onSubmit(question);
        }
    };

    return (
        <motion.form
            onSubmit={handleSubmit}
            className="w-full max-w-2xl mx-auto mt-10"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
        >
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex items-center glass-panel rounded-lg p-1">
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Will [X] happen by 2025?"
                        className="w-full bg-transparent text-white p-4 outline-none placeholder-gray-500 text-lg"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !question}
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-bold py-3 px-8 rounded-md hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? "GENERATING..." : "CREATE"}
                    </button>
                </div>
            </div>
        </motion.form>
    );
}
