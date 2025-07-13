import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { ResponsiveLayout } from '@/components/layout/responsive-layout';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Noti - AI Transcription Dashboard',
  description: 'Premium AI-powered audio transcription with speaker diarization',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={cn(inter.className, "h-full bg-background")}>
        <ResponsiveLayout>
          {children}
        </ResponsiveLayout>
        <Toaster richColors position="top-right" />
        <script src="/unregister-sw.js" defer />
      </body>
    </html>
  );
}