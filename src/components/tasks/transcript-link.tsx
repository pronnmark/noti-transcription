'use client';

import { Button } from '@/components/ui/button';
import { Play, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptLinkProps {
  fileId: string;
  timestamp?: number;
  speaker?: string;
  className?: string;
}

export function TranscriptLink({ fileId, timestamp, speaker, className }: TranscriptLinkProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = () => {
    const url = `/transcript/${fileId}${timestamp ? `?t=${timestamp}` : ''}`;
    window.location.href = url;
  };

  if (!timestamp) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={cn('text-muted-foreground hover:text-foreground', className)}
      >
        <Play className="h-3 w-3 mr-1" />
        View transcript
      </Button>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Clock className="h-3 w-3" />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className="h-auto p-0 text-muted-foreground hover:text-foreground"
      >
        {formatTime(timestamp)}
      </Button>
      {speaker && (
        <>
          <span>•</span>
          <span>{speaker}</span>
        </>
      )}
    </div>
  );
}
