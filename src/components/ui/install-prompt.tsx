'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UnibodyCard } from '@/components/ui/unibody-card';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<
    'ios' | 'android' | 'desktop' | 'other'
  >('other');

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    } else {
      setPlatform('desktop');
    }

    // Check if already installed
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for this session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('install-prompt-dismissed', 'true');
    }
  };

  // Don't show if already installed or dismissed in this session
  if (
    isInstalled ||
    (typeof window !== 'undefined' &&
      sessionStorage.getItem('install-prompt-dismissed') === 'true') ||
    !showPrompt
  ) {
    return null;
  }

  const getInstallInstructions = () => {
    switch (platform) {
      case 'ios':
        return {
          icon: <Smartphone className='h-4 w-4' />,
          title: 'Install Noti on iOS',
          instructions: [
            'Tap the Share button in Safari',
            'Scroll down and tap "Add to Home Screen"',
            'Confirm by tapping "Add"',
          ],
        };
      case 'android':
        return {
          icon: <Smartphone className='h-4 w-4' />,
          title: 'Install Noti on Android',
          instructions: [
            'Tap "Install" below or',
            'Tap the menu (⋮) in Chrome',
            'Select "Add to Home screen"',
          ],
        };
      default:
        return {
          icon: <Monitor className='h-4 w-4' />,
          title: 'Install Noti on Desktop',
          instructions: [
            'Click "Install" below or',
            'Look for the install icon in your address bar',
            'Install for quick access from your desktop',
          ],
        };
    }
  };

  const { icon, title, instructions } = getInstallInstructions();

  return (
    <div className='fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm md:bottom-4'>
      <UnibodyCard className='border border-primary/20 shadow-lg'>
        <div className='mb-3 flex items-start justify-between'>
          <div className='flex items-center gap-2'>
            {icon}
            <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
          </div>
          <Button
            variant='ghost'
            size='sm'
            className='-mr-1 -mt-1 h-6 w-6 p-0'
            onClick={handleDismiss}
          >
            <X className='h-3 w-3' />
          </Button>
        </div>

        <div className='space-y-3'>
          <div className='text-xs text-muted-foreground'>
            <p className='mb-2'>Get the full app experience:</p>
            <ul className='space-y-1'>
              {instructions.map((instruction, index) => (
                <li key={index} className='flex items-start gap-2'>
                  <span className='mt-0.5 text-[10px] font-bold text-primary'>
                    •
                  </span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className='flex gap-2'>
            {deferredPrompt && platform !== 'ios' && (
              <Button
                onClick={handleInstall}
                size='sm'
                className='flex-1 bg-primary text-primary-foreground hover:bg-primary/90'
              >
                <Download className='mr-1 h-3 w-3' />
                Install
              </Button>
            )}
            <Button
              onClick={handleDismiss}
              variant='outline'
              size='sm'
              className={cn(
                '',
                deferredPrompt && platform !== 'ios' ? '' : 'flex-1'
              )}
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </UnibodyCard>
    </div>
  );
}

// Hook for checking PWA installation status
export function usePWAInstall() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      );
    };

    setIsInstalled(checkInstalled());

    const handleBeforeInstallPrompt = () => {
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return { isInstalled, canInstall };
}
