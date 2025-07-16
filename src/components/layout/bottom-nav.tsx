'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/files', label: 'Files' },
    { href: '/ai/extractions', label: 'Extractions' },
    { href: '/ai/data-points', label: 'Data Points' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border",
      "flex items-center justify-around p-2 pb-safe safe-area-inset-bottom",
      className
    )}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Button
            key={item.href}
            variant="ghost"
            size="sm"
            className={cn(
              "flex flex-col items-center gap-1 min-w-0 flex-1 h-12 px-2 py-1 touch-target-44",
              isActive && "text-primary"
            )}
            onClick={() => router.push(item.href)}
          >
            <span className="text-xs font-medium truncate">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
}