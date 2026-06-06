import './globals.css';
import * as React from 'react';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'SYDT · Sohbet',
  description: 'Kategori bazlı kanallar ve ekip sohbeti. CTFd CSV ile kanal yapısı oluşturulabilir.',
  applicationName: 'SYDT',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#070b14',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
