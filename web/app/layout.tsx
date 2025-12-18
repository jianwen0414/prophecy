import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prophecy - DeFAI Forecasting & Verification Platform',
  description: 'AI-powered prediction markets on Solana. Make forecasts, earn reputation, and verify truth with the AI Council.',
  keywords: ['solana', 'prediction market', 'ai', 'forecasting', 'blockchain', 'defi'],
  openGraph: {
    title: 'Prophecy - Predict the Future',
    description: 'AI-powered forecasting platform on Solana',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
