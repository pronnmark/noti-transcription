'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Auto-close sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const closeSidebar = () => setSidebarOpen(false);

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
                <X className="h-4 w-4" />
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
          <div className="flex items-center justify-between p-4 border-b bg-white md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="h-9 w-9 p-0"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Noti</h1>
            <div className="w-9" /> {/* Spacer for centering */}
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}