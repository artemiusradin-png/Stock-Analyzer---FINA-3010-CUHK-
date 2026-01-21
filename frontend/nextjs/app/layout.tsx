import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavBar from './components/NavBar';
import RouteTransition from './components/RouteTransition';
import AssistantWidget from './components/AssistantWidget';
import Footer from './components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ARQAM Portfolio Management',
  description: 'Portfolio management and trading analysis system',
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
