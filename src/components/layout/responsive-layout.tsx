'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { usePathname } from 'next/navigation';
import { ClientOnly } from '@/components/client-only';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  
  const closeSidebar = () => setSidebarOpen(false);
  
  return (
    <ClientOnly fallback={<div className="flex h-full bg-background">{children}</div>}>
      <ResponsiveLayoutInner 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen}
        pathname={pathname}
        closeSidebar={closeSidebar}
      >
        {children}
      </ResponsiveLayoutInner>
    </ClientOnly>
  );
}

interface ResponsiveLayoutInnerProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  pathname: string;
  closeSidebar: () => void;
}

function ResponsiveLayoutInner({ 
  children, 
  sidebarOpen, 
  setSidebarOpen, 
  pathname,
  closeSidebar 
}: ResponsiveLayoutInnerProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Auto-close sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile, setSidebarOpen]);

  // Get page title based on current path
  const getPageTitle = () => {
    switch (pathname) {
      case '/':
        return 'Dashboard';
      case '/files':
        return 'Files';
      case '/record':
        return 'Record';
      case '/transcripts':
        return 'Transcripts';
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
        return 'Noti';
    }
  };

  return (
    <div className="flex h-full">
      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden md:flex md:flex-shrink-0",
        "transition-all duration-300"
      )}>
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50" 
            onClick={closeSidebar}
            aria-hidden="true"
          />
          
          {/* Sidebar */}
          <div className="relative flex w-64 flex-col bg-white border-r animate-slide-in-from-left shadow-xl">
            {/* Close button */}
            <div className="absolute right-2 top-2 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={closeSidebar}
                className="h-8 w-8 p-0"
              >
                ✕
                <span className="sr-only">Close sidebar</span>
              </Button>
            </div>
            <Sidebar onNavigate={closeSidebar} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b bg-background md:hidden safe-area-inset-top">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="h-9 w-9 p-0 touch-target-44"
              aria-label="Open sidebar"
            >
              ☰
            </Button>
            <h1 className="text-lg font-semibold text-foreground truncate max-w-[200px]">{getPageTitle()}</h1>
            <div className="flex items-center gap-2">
              {/* Quick actions based on current page */}
              {pathname === '/files' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = '/record'}
                  className="h-9 px-2 text-sm touch-target-44"
                >
                  Record
                </Button>
              )}
              {pathname === '/transcripts' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = '/files'}
                  className="h-9 px-2 text-sm touch-target-44"
                >
                  Upload
                </Button>
              )}
              {pathname === '/' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = '/files'}
                  className="h-9 px-2 text-sm touch-target-44"
                >
                  Upload
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className={cn(
          "flex-1 overflow-hidden",
          isMobile && "pb-16 safe-area-inset-bottom" // Add bottom padding for mobile navigation
        )}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNav />}
    </div>
  );
}