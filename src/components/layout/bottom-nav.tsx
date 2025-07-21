'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { FileAudio, Mic, Sparkles, Settings, Plus, LayoutDashboard } from 'lucide-react';

interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { 
      href: '/dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      isActive: pathname === '/dashboard' || pathname === '/'
    },
    { 
      href: '/files', 
      label: 'Files', 
      icon: FileAudio,
      isActive: pathname === '/files'
    },
    { 
      href: '/record', 
      label: 'Record', 
      icon: Mic,
      isActive: pathname === '/record'
    },
    { 
      href: '/ai/summarization', 
      label: 'AI', 
      icon: Sparkles,
      isActive: pathname.startsWith('/ai/')
    },
    { 
      href: '/settings', 
      label: 'Settings', 
      icon: Settings,
      isActive: pathname === '/settings'
    },
  ];

  return (
    <div className={cn(
      // iOS-native styling with blur background and subtle elevation
      "fixed bottom-0 left-0 right-0 z-50",
      "bg-white/80 backdrop-blur-xl border-t border-gray-200/50",
      "shadow-[0_-1px_20px_rgba(0,0,0,0.08)]",
      "safe-area-inset-bottom",
      className
    )}>
      {/* iOS-style tab bar container */}
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              className={cn(
                // Unibody touch target - 44px minimum per iOS HIG
                "flex flex-col items-center justify-center gap-1",
                "min-w-0 flex-1 h-[60px] px-2 py-1.5",
                "touch-target-44 touch-manipulation",
                "transition-all duration-200 ease-out",
                "rounded-lg", // Subtle chamfered edge
                // Active state with single accent color
                item.isActive 
                  ? "text-blue-600" 
                  : "text-gray-600 hover:text-gray-800 active:scale-95"
              )}
              onClick={() => router.push(item.href)}
              aria-label={item.label}
            >
              {/* Icon with iOS-style scaling for active state */}
              <Icon 
                className={cn(
                  "transition-all duration-200 ease-out",
                  item.isActive 
                    ? "w-6 h-6 scale-110" 
                    : "w-5 h-5"
                )} 
              />
              
              {/* Typography following iOS system font hierarchy */}
              <span 
                className={cn(
                  "text-[10px] font-medium leading-tight tracking-wide",
                  "transition-all duration-200 ease-out",
                  item.isActive 
                    ? "opacity-100 font-semibold" 
                    : "opacity-75"
                )}
              >
                {item.label}
              </span>
              
              {/* Active indicator dot - purposeful existence */}
              {item.isActive && (
                <div className="absolute bottom-1 w-1 h-1 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}