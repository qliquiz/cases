import './globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Case Lab — бесплатный симулятор кейсов',
    description:
        'Открывай виртуальные кейсы с прозрачными шансами и без ставок.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html lang="ru" className="h-full antialiased">
            <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}
