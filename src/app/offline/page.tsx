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
    <div className='flex min-h-screen items-center justify-center bg-background px-4'>
      <div className='w-full max-w-md space-y-6'>
        <UnibodyCard className='py-8 text-center'>
          <div className='mb-6 flex justify-center'>
            <div className='rounded-full bg-muted p-4'>
              <WifiOff className='h-12 w-12 text-muted-foreground' />
            </div>
          </div>

          <h1 className='mb-3 text-2xl font-semibold text-foreground'>
            You're Offline
          </h1>

          <p className='mb-8 leading-relaxed text-muted-foreground'>
            It looks like you've lost your internet connection. Some features
            may not be available while offline.
          </p>

          {isOnline && (
            <div className='mb-6 rounded-lg border border-green-200 bg-green-50 p-3'>
              <p className='text-sm font-medium text-green-800'>
                ✅ Connection restored! You can now continue using Noti.
              </p>
            </div>
          )}

          <div className='space-y-3'>
            <Button
              onClick={handleRetry}
              className='w-full bg-primary text-primary-foreground hover:bg-primary/90'
              size='lg'
            >
              <RefreshCw className='mr-2 h-4 w-4' />
              Try Again
            </Button>

            <Button
              onClick={() => router.push('/')}
              variant='outline'
              className='w-full'
              size='lg'
            >
              <Home className='mr-2 h-4 w-4' />
              Go to Dashboard
            </Button>
          </div>
        </UnibodyCard>

        <UnibodyCard className='py-4'>
          <div className='space-y-3'>
            <h2 className='flex items-center gap-2 font-medium text-foreground'>
              <FileAudio className='h-4 w-4' />
              While Offline
            </h2>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li className='flex items-start gap-2'>
                <span className='font-bold text-green-600'>✓</span>
                View previously loaded transcripts
              </li>
              <li className='flex items-start gap-2'>
                <span className='font-bold text-green-600'>✓</span>
                Access cached files and recordings
              </li>
              <li className='flex items-start gap-2'>
                <span className='font-bold text-amber-600'>⚠</span>
                File uploads will resume when back online
              </li>
              <li className='flex items-start gap-2'>
                <span className='font-bold text-red-600'>✗</span>
                AI processing requires internet connection
              </li>
            </ul>
          </div>
        </UnibodyCard>

        <div className='text-center'>
          <p className='text-xs text-muted-foreground'>
            Noti PWA - Works offline with cached content
          </p>
        </div>
      </div>
    </div>
  );
}
