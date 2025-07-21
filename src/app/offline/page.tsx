'use client';

import { Button } from '@/components/ui/button';
import { UnibodyCard } from '@/components/ui/unibody-card';
import { WifiOff, RefreshCw, Home, FileAudio } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (navigator.onLine) {
      router.push('/');
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full space-y-6">
        <UnibodyCard className="text-center py-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-muted rounded-full">
              <WifiOff className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-foreground mb-3">
            You're Offline
          </h1>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            It looks like you've lost your internet connection. Some features may not be available while offline.
          </p>

          {isOnline && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm font-medium">
                ✅ Connection restored! You can now continue using Noti.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleRetry}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>

            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </UnibodyCard>

        <UnibodyCard className="py-4">
          <div className="space-y-3">
            <h2 className="font-medium text-foreground flex items-center gap-2">
              <FileAudio className="h-4 w-4" />
              While Offline
            </h2>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                View previously loaded transcripts
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                Access cached files and recordings
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">⚠</span>
                File uploads will resume when back online
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">✗</span>
                AI processing requires internet connection
              </li>
            </ul>
          </div>
        </UnibodyCard>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Noti PWA - Works offline with cached content
          </p>
        </div>
      </div>
    </div>
  );
}
