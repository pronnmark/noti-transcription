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
  
  // Debug mode - show raw values
  const debugMode = false; // Disable debug mode
  
  // Determine color based on audio level
  const getBarColor = (level: number) => {
    if (level === 0) return 'bg-gray-400'; // No signal (gray instead of red)
    if (level < 5) return 'bg-red-500'; // Very low signal
    if (level < 25) return 'bg-yellow-500'; // Low signal
    if (level < 75) return 'bg-green-500'; // Good signal
    return 'bg-green-600'; // High signal
  };

  const getBarGradient = (level: number) => {
    if (level === 0) return 'from-gray-400 to-gray-300';
    if (level < 5) return 'from-red-500 to-red-400';
    if (level < 25) return 'from-yellow-500 to-yellow-400';
    if (level < 75) return 'from-green-500 to-green-400';
    return 'from-green-600 to-green-500';
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="text-xs text-muted-foreground font-medium">
        Audio Level
      </div>
      
      {/* Debug info */}
      {debugMode && (
        <div className="bg-gray-100 rounded p-2 text-xs font-mono">
          <div>Raw prop: {audioLevel.toFixed(2)}</div>
          <div>Normalized: {normalizedLevel.toFixed(2)}</div>
          <div>isActive: {isActive.toString()}</div>
        </div>
      )}
      
      {/* Audio level bar */}
      <div className="w-full max-w-xs h-8 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-300">
        <div
          className={cn(
            'h-full transition-all duration-100 ease-out rounded-full bg-gradient-to-r',
            getBarGradient(normalizedLevel)
          )}
          style={{ width: `${Math.max(0, normalizedLevel)}%` }}
        />
      </div>
      
      {/* Level indicator text */}
      <div className="flex items-center gap-2 text-xs">
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-colors duration-200',
            normalizedLevel === 0 ? 'bg-gray-400' : getBarColor(normalizedLevel)
          )}
        />
        <span className="text-muted-foreground">
          {normalizedLevel === 0 ? 'Silent' :
           normalizedLevel < 5 ? 'Very Low' : 
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