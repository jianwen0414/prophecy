# 🔮 Prophecy

**Prophecy** is a futuristic, cyberpunk-themed prediction market platform built on the Solana blockchain. It leverages a Council of AI Agents to autonomously research, judge, and resolve market outcomes, creating a trust-minimized betting experience.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-Alpha-orange.svg)

## 🏗️ Architecture

The platform consists of three core pillars:

```mermaid
graph TD
    User[User] -->|Interacts| UI[Next.js Cyberpunk UI]
    UI -->|Blinks/Actions| Solana[Solana Blockchain (Anchor)]
    
    subgraph "AI Agent Council (LangGraph)"
        Researcher[🕵️ Researcher Node] -->|Gemini 2.0| Web[Web Search]
        Researcher -->|Facts| Judge[⚖️ Judge Node]
        Judge -->|Decision| Executor[⚡ Executor Node]
    end
    
    Executor -->|Resolve Market| Solana
```

## ✨ Key Features

### 1. 🤖 AI Agent Council
Powered by **LangGraph** and **Google Gemini 2.0 Flash**, our autonomous agent system resolves markets without human intervention.
- **Researcher Node**: Scours the web for real-time facts and context regarding the market question.
- **Judge Node**: Evaluates evidence logically to render a verdict (YES, NO, or UNCERTAIN).
- **Executor Node**: Interacts directly with the Solana blockchain to finalize markets on-chain.
- **Robustness**: Built-in rate limiting and exponential backoff to handle API constraints gracefully.

### 2. ⚡ Solana Smart Contracts
Built with **Anchor Framework** for high-speed, low-cost decentralized betting.
- **Market Creation**: Anyone can initialize a prediction market.
- **Betting**: Users pledge SOL to "Yes" or "No" outcomes.
- **Resolution**: Secure instruction for the Agent Council to settle bets.

### 3. 🎨 Futuristic Frontend
An immersive **Next.js 14+** application designed with a "Cyberpunk Glassmorphism" aesthetic.
- **Visuals**: Neon glows, holographic card effects, and animated text entrances.
- **Tech**: Tailwind CSS v4, Framer Motion.
- **Blinks**: Integration with Solana Actions (Blinks) for shareable, embeddable betting widgets.

## 🛠️ Tech Stack

- **Blockchain**: Solana, Anchor, Rust
- **Backend (AI)**: TypeScript, LangGraph, Google Gemini API (v1beta)
- **Frontend**: Next.js, React, Tailwind CSS
- **Tools**: `ts-node`, `wsl` support

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Rust & Cargo
- Solana CLI
- Google Gemini API Key

### 1. Installation
Clne the repository and install dependencies for both the frontend and agent.

```bash
# Root directory (if using workspaces) or separate folders
npm install
```

### 2. Environment Setup
Create a `.env` file in the `agent` directory:

```env
GEMINI_API_KEY=your_google_gemini_api_key
```

### 3. Running the Agent
The agent runs as a standalone service to monitor and resolve markets.

```bash
cd agent
npx ts-node graph.ts
```

### 4. Running the Frontend
Start the immersive web experience.

```bash
cd web
npm run dev
```

## ⚠️ Notes
- The Agent uses **Gemini 2.0 Flash** via direct REST API calls to ensure availability and performance.
- Rate limits are handled automatically; if you see `429 Resource exhausted` logs, the agent is simply waiting for its quota to refresh.
