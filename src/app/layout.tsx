import './globals.css';

import type { Metadata } from 'next';

import { QueryProvider } from '@/app/query-provider';
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
            <body className="min-h-full flex flex-col">
                <QueryProvider>{children}</QueryProvider>
            </body>
        </html>
    );
}
