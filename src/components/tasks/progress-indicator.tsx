'use client';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  completed: number;
  total: number;
  label?: string;
  className?: string;
}

export function ProgressIndicator({ completed, total, label, className }: ProgressIndicatorProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">
            {completed} of {total} ({Math.round(percentage)}%)
          </span>
        </div>
      )}
      <Progress value={percentage} className="h-2" />
    </div>
  );
}