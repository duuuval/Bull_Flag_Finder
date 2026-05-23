import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BFF · Bull Flag Finder',
  description: 'Daily bull flag scanner for the S&P 1500. No paywall. No noise.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-bg text-text font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
