'use client';

import { cn } from '@/lib/utils';

interface AudioLevelMeterProps {
  audioLevel: number; // 0-100
  isActive: boolean;
  className?: string;
}

export function AudioLevelMeter({ audioLevel, isActive, className }: AudioLevelMeterProps) {
  // Normalize audio level to 0-100 range
  const normalizedLevel = Math.max(0, Math.min(100, audioLevel));
  
  // Determine color based on audio level
  const getBarColor = (level: number) => {
    if (level < 5) return 'bg-red-500'; // No signal
    if (level < 25) return 'bg-yellow-500'; // Low signal
    return 'bg-green-500'; // Good signal
  };

  const getBarGradient = (level: number) => {
    if (level < 5) return 'from-red-500 to-red-400';
    if (level < 25) return 'from-yellow-500 to-yellow-400';
    return 'from-green-500 to-green-400';
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="text-xs text-muted-foreground font-medium">
        Audio Level
      </div>
      
      {/* Audio level bar */}
      <div className="w-full max-w-xs h-6 bg-gray-200 rounded-full overflow-hidden border">
        <div
          className={cn(
            'h-full transition-all duration-75 ease-out rounded-full bg-gradient-to-r',
            getBarGradient(normalizedLevel)
          )}
          style={{ width: `${normalizedLevel}%` }}
        />
      </div>
      
      {/* Level indicator text */}
      <div className="flex items-center gap-2 text-xs">
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-colors duration-200',
            getBarColor(normalizedLevel)
          )}
        />
        <span className="text-muted-foreground">
          {normalizedLevel < 5 ? 'No Signal' : 
           normalizedLevel < 25 ? 'Low' : 
           normalizedLevel < 75 ? 'Good' : 'High'}
        </span>
        <span className="text-xs font-mono text-muted-foreground ml-2">
          {normalizedLevel.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}