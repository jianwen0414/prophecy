import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
