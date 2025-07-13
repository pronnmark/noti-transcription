'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Mic, Settings, FileAudio, Files, FileText, Sparkles, ListTodo, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home,
  },
  {
    name: 'Files',
    href: '/files',
    icon: Files,
  },
  {
    name: 'Record',
    href: '/record',
    icon: Mic,
  },
  {
    name: 'Transcripts',
    href: '/transcripts',
    icon: FileText,
  },
  {
    name: 'AI Tools',
    icon: Sparkles,
    children: [
      {
        name: 'Extracts',
        href: '/ai/extracts',
        icon: Sparkles,
      },
      {
        name: 'Notes',
        href: '/ai/notes',
        icon: ListTodo,
      },
    ],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
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
      <div className="flex h-16 items-center px-6 border-b">
        <FileAudio className="h-8 w-8 text-primary mr-3" />
        <span className="text-xl font-bold">Noti</span>
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
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    hasActiveChild
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                  <ChevronDown 
                    className={cn(
                      "ml-auto h-4 w-4 transition-transform",
                      isExpanded ? "rotate-180" : ""
                    )}
                  />
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
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            childIsActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <child.icon className="h-4 w-4" />
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
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                itemIsActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Version */}
      <div className="p-4 text-xs text-muted-foreground">
        Version 1.0.0
      </div>
    </div>
  );
}