'use client';

import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, Upload, FileText } from 'lucide-react';
import type { WorkflowPhase } from '@/stores/recordingStore';

interface WorkflowStatusProps {
  phase: WorkflowPhase;
  uploadProgress?: number;
  transcriptionProgress?: number;
  error?: string | null;
  estimatedTimeRemaining?: number | null;
  className?: string;
}

export function WorkflowStatus({
  phase,
  uploadProgress = 0,
  transcriptionProgress = 0,
  error,
  estimatedTimeRemaining,
  className,
}: WorkflowStatusProps) {
  if (phase === 'idle' || phase === 'recording') {
    return null; // Don't show workflow status during recording
  }

  const getPhaseInfo = () => {
    switch (phase) {
      case 'uploading':
        return {
          icon: <Upload className="h-5 w-5" />,
          title: 'Uploading Recording',
          description: 'Saving your audio file...',
          progress: uploadProgress,
          color: 'blue',
        };
      case 'transcribing':
        return {
          icon: <FileText className="h-5 w-5" />,
          title: 'Transcribing Audio',
          description: 'Converting speech to text...',
          progress: transcriptionProgress,
          color: 'purple',
        };
      case 'completed':
        return {
          icon: <CheckCircle className="h-5 w-5" />,
          title: 'Transcription Complete',
          description: 'Your transcript is ready!',
          progress: 100,
          color: 'green',
        };
      case 'error':
        return {
          icon: <XCircle className="h-5 w-5" />,
          title: 'Error Occurred',
          description: error || 'Something went wrong',
          progress: 0,
          color: 'red',
        };
      default:
        return null;
    }
  };

  const phaseInfo = getPhaseInfo();
  if (!phaseInfo) return null;

  const { icon, title, description, progress, color } = phaseInfo;

  const formatTimeRemaining = (seconds: number) => {
    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s remaining`;
  };

  return (
    <div className={cn('space-y-4 p-6 border rounded-lg bg-card', className)}>
      {/* Status Header */}
      <div className="flex items-center gap-3">
        <div className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full',
          phase === 'uploading' && 'bg-blue-100 text-blue-600',
          phase === 'transcribing' && 'bg-purple-100 text-purple-600',
          phase === 'completed' && 'bg-green-100 text-green-600',
          phase === 'error' && 'bg-red-100 text-red-600'
        )}>
          {phase === 'uploading' || phase === 'transcribing' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            icon
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        
        {(phase === 'uploading' || phase === 'transcribing') && (
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {progress.toFixed(0)}%
            </div>
            {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
              <div className="text-xs text-muted-foreground">
                {formatTimeRemaining(estimatedTimeRemaining)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {(phase === 'uploading' || phase === 'transcribing' || phase === 'completed') && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300 ease-out rounded-full',
                color === 'blue' && 'bg-blue-500',
                color === 'purple' && 'bg-purple-500',
                color === 'green' && 'bg-green-500'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {phase === 'transcribing' && progress > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Processing audio...</span>
              <span>{progress.toFixed(1)}% complete</span>
            </div>
          )}
        </div>
      )}

      {/* Error Details */}
      {phase === 'error' && error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}