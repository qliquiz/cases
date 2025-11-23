import { ReactNode } from 'react';
import Script from 'next/script';
import type { Metadata } from 'next';
import { Theme } from '@radix-ui/themes';

import { AuthProvider } from './AuthContext';
import { geistMono, geistSans } from './fonts';

import '@radix-ui/themes/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'case go',
  description: 'CS cases simulator',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="afterInteractive"
        />
        <AuthProvider>
          <Theme>{children}</Theme>
        </AuthProvider>
      </body>
    </html>
  );
}
