'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { usePathname } from 'next/navigation';
import { ClientOnly } from '@/components/client-only';
import { Settings } from 'lucide-react';
import TemplateManagementModal from '@/components/TemplateManagementModal';
import { getSessionToken } from '@/lib/auth-client';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const pathname = usePathname();
  
  return (
    <ClientOnly fallback={<div className="flex h-full bg-background">{children}</div>}>
      <ResponsiveLayoutInner 
        pathname={pathname}
        isTemplateModalOpen={isTemplateModalOpen}
        setIsTemplateModalOpen={setIsTemplateModalOpen}
      >
        {children}
      </ResponsiveLayoutInner>
    </ClientOnly>
  );
}

interface ResponsiveLayoutInnerProps {
  children: React.ReactNode;
  pathname: string;
  isTemplateModalOpen: boolean;
  setIsTemplateModalOpen: (open: boolean) => void;
}

function ResponsiveLayoutInner({ 
  children, 
  pathname,
  isTemplateModalOpen,
  setIsTemplateModalOpen
}: ResponsiveLayoutInnerProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const sessionToken = getSessionToken();
      setIsAuthenticated(!!sessionToken);
    };
    
    // Initial check
    checkAuth();
    
    // Listen for storage changes (when user logs in/out)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'noti-session') {
        checkAuth();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case localStorage changes within same tab
    const interval = setInterval(checkAuth, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Get page title based on current path
  const getPageTitle = () => {
    switch (pathname) {
      case '/':
        return 'Dashboard';
      case '/dashboard':
        return 'Dashboard';
      case '/files':
        return 'Files';
      case '/record':
        return 'Record';
      case '/ai/summarization':
        return 'Summarization';
      case '/ai/extractions':
        return 'Extractions';
      case '/ai/data-points':
        return 'Data Points';
      // Keep old routes for backward compatibility
      case '/ai/extracts':
        return 'AI Extracts';
      case '/ai/notes':
        return 'AI Notes';
      case '/ai/tasks':
        return 'AI Tasks';
      case '/analytics':
        return 'Analytics';
      case '/docs':
        return 'Documentation';
      case '/settings':
        return 'Settings';
      default:
        if (pathname.startsWith('/transcript/')) {
          return 'Transcript';
        }
        return 'Noti';
    }
  };

  // Don't render navigation elements for login page or when not authenticated
  const showNavigation = isAuthenticated && pathname !== '/';

  return (
    <div className="flex h-full">
      {/* Desktop Sidebar - only show when authenticated and not on login page */}
      {showNavigation && (
        <div className={cn(
          "hidden md:flex md:flex-shrink-0",
          "transition-all duration-300"
        )}>
          <Sidebar />
        </div>
      )}


      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header - only show when authenticated and not on login page */}
        {isMobile && showNavigation && (
          <div className="flex items-center justify-center buzz-header-mobile border-b bg-background md:hidden safe-area-inset-top touch-manipulation">
            <h1 className="text-xl font-medium text-foreground truncate max-w-[280px]">{getPageTitle()}</h1>
            <div className="absolute right-4 flex items-center gap-2">
              {/* Quick actions based on current page */}
              {pathname === '/ai/summarization' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="h-9 px-3 text-sm touch-target-44 flex items-center gap-2 font-medium touch-manipulation text-primary"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Templates
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className={cn(
          "flex-1 overflow-hidden",
          isMobile && showNavigation && "pb-16 safe-area-inset-bottom" // Add bottom padding for mobile navigation
        )}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation - only show when authenticated and not on login page */}
      {isMobile && showNavigation && <BottomNav />}

      {/* Template Management Modal */}
      <TemplateManagementModal
        isOpen={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        onTemplatesUpdated={() => {
          // Trigger a page refresh to reload templates
          window.location.reload();
        }}
      />
    </div>
  );
}