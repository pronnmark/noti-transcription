'use client';

import { Badge } from '@/components/ui/badge';
import { Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LabelBadgeProps {
  labels: string[];
  maxVisible?: number;
  size?: 'sm' | 'md';
  className?: string;
  onClick?: (label: string) => void;
}

const LABEL_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-red-100 text-red-800 border-red-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
];

export function LabelBadge({
  labels,
  maxVisible = 3,
  size = 'sm',
  className,
  onClick,
}: LabelBadgeProps) {
  if (!labels || labels.length === 0) return null;

  // Color assignment based on label text
  const getLabelColor = (label: string) => {
    const hash = label.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
  };

  const visibleLabels = labels.slice(0, maxVisible);
  const remainingCount = Math.max(0, labels.length - maxVisible);

  const badgeSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {visibleLabels.map((label) => (
        <Badge
          key={label}
          variant="secondary"
          className={cn(
            badgeSize,
            'border',
            getLabelColor(label),
            onClick && 'cursor-pointer hover:opacity-80',
          )}
          onClick={() => onClick?.(label)}
        >
          <Tag className={cn(iconSize, 'mr-1')} />
          {label}
        </Badge>
      ))}

      {remainingCount > 0 && (
        <Badge
          variant="secondary"
          className={cn(
            badgeSize,
            'bg-gray-100 text-gray-600 border-gray-200',
          )}
        >
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
}
