'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
  },
  {
    name: 'Files',
    href: '/files',
  },
  {
    name: 'Record',
    href: '/record',
  },
  {
    name: 'AI',
    href: '/ai/summarization',
  },
  {
    name: 'Settings',
    href: '/settings',
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b bg-muted/30">
        <Image 
          src="/logo.svg" 
          alt="Noti" 
          width={120} 
          height={32}
          className="h-8 w-auto"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const itemIsActive = isActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                itemIsActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* App Info */}
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground text-center">
          Version 1.0.0
        </div>
      </div>
    </div>
  );
}