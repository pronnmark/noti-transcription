'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
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
    name: 'Transcripts',
    href: '/transcripts',
  },
  {
    name: 'AI Tools',
    children: [
      {
        name: 'Summarization',
        href: '/ai/summarization',
      },
      {
        name: 'Extractions',
        href: '/ai/extractions',
      },
      {
        name: 'Data Points',
        href: '/ai/data-points',
      },
    ],
  },
  {
    name: 'Documentation',
    href: '/docs',
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['AI Tools']));

  const toggleExpanded = (name: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isChildActive = (children?: any[]) => {
    if (!children) return false;
    return children.some(child => isActive(child.href));
  };

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b bg-muted/30">
        <span className="text-xl font-bold text-foreground">Noti</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const itemIsActive = isActive(item.href);
          const hasActiveChild = isChildActive(item.children);
          const isExpanded = expandedItems.has(item.name);

          if (item.children) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleExpanded(item.name)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    hasActiveChild
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span>{item.name}</span>
                  <span className={cn(
                    "text-xs transition-transform",
                    isExpanded ? "rotate-180" : ""
                  )}>
                    ▼
                  </span>
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const childIsActive = isActive(child.href);
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          onClick={onNavigate}
                          className={cn(
                            'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            childIsActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          {child.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

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

      {/* Logout & Version */}
      <div className="border-t p-4 space-y-3">
        <button
          onClick={async () => {
            try {
              const response = await fetch('/api/auth/logout', { method: 'POST' });
              if (response.ok) {
                window.location.href = '/login';
              }
            } catch (error) {
              console.error('Logout failed:', error);
            }
          }}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Logout
        </button>
        <div className="text-xs text-muted-foreground text-center">
          Version 1.0.0
        </div>
      </div>
    </div>
  );
}