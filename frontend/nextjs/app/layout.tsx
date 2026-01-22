import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavBar from './components/NavBar';
import RouteTransition from './components/RouteTransition';
import AssistantWidget from './components/AssistantWidget';
import Footer from './components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ARQAM - Financial Analytics Platform',
  description: 'Advanced portfolio management, stock research, and trading analysis powered by AI',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'ARQAM - Financial Analytics Platform',
    description: 'Advanced portfolio management, stock research, and trading analysis powered by AI',
    images: ['/arqam-logo.svg'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ARQAM - Financial Analytics Platform',
    description: 'Advanced portfolio management, stock research, and trading analysis powered by AI',
    images: ['/arqam-logo.svg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NavBar />
        <RouteTransition>{children}</RouteTransition>
        <Footer />
        <AssistantWidget />
      </body>
    </html>
  );
}
