'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Auto-close sidebar on mobile when window resizes
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50" 
            onClick={closeSidebar}
          />
          
          {/* Sidebar */}
          <div className="relative flex w-64 flex-col bg-card border-r">
            <Sidebar onNavigate={closeSidebar} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b bg-card md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="p-2"
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