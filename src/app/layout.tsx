import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { ResponsiveLayout } from '@/components/layout/responsive-layout';
import { cn } from '@/lib/utils';

const nunito = Nunito({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-nunito',
});

export const metadata: Metadata = {
  title: 'Noti - AI Transcription Dashboard',
  description: 'Premium AI-powered audio transcription with speaker diarization',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Noti',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Noti" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192x192.svg" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icon-192x192.svg" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icon-192x192.svg" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icon-192x192.svg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={cn(nunito.className, "h-full bg-background")} suppressHydrationWarning>
        <ResponsiveLayout>
          {children}
        </ResponsiveLayout>
        <Toaster richColors position="top-right" />
        <script src="/unregister-sw.js" defer />
        <script src="/install-prompt.js" defer />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Only register service worker in production
            if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                  .then(registration => {
                    console.log('SW registered:', registration);
                    // Force update if there's a waiting service worker
                    if (registration.waiting) {
                      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                  })
                  .catch(error => console.log('SW registration failed:', error));
              });
            } else if (process.env.NODE_ENV === 'development') {
              // Clear any existing service worker registrations in development
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                  registrations.forEach(registration => {
                    registration.unregister();
                  });
                });
              }
            }
          `
        }} />
      </body>
    </html>
  );
}