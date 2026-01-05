import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { SessionProvider } from '@/components/auth/SessionProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Toaster } from '@/components/ui/toaster';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Kalavara - Personal Expense Tracker',
  description: 'Local-first personal expense tracker that automatically collects transaction data from bank email notifications',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 pl-64">
              <Header />
              <main className="p-6">{children}</main>
            </div>
          </div>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
