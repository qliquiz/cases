import './globals.css';

import type { Metadata } from 'next';

import { themeInitScript } from '@/browser/theme';

export const metadata: Metadata = {
    title: 'CaseGo — бесплатный симулятор кейсов',
    description:
        'Открывай виртуальные кейсы с прозрачными шансами и без ставок.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html lang="ru" className="h-full antialiased" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}
