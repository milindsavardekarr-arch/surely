import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Surely — WhatsApp Relationship AI',
  description: 'AI-powered customer relationship management via WhatsApp',
  icons: {
    icon: '/surely-favicon.png',
    shortcut: '/surely-favicon.png',
    apple: '/surely-favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body
        className="antialiased"
        style={{
          backgroundColor: '#09090b',
          color: '#f4f4f5',
          fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        }}
      >
        <Providers>
          {children}

          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#27272a',
                color: '#f4f4f5',
                border: '1px solid #3f3f46',
                borderRadius: '12px',
                fontSize: '14px',
                fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
              },
              success: {
                iconTheme: { primary: '#25D366', secondary: '#052e16' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#450a0a' },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
