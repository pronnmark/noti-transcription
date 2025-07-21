'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, CheckCircle, XCircle } from 'lucide-react';

interface TranscriptionStatusProps {
  fileId: number;
  initialStatus?: string;
}

export function TranscriptionStatus({ fileId, initialStatus }: TranscriptionStatusProps) {
  const [status, setStatus] = useState(initialStatus || 'none');
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fileId]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`/api/transcribe/status/${fileId}`);
      const data = await response.json();

      if (data.exists && data.job) {
        setStatus(data.job.status);
        setProgress(data.job.progress || 0);
        if (data.job.transcript) {
          setTranscript(data.job.transcript);
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const startTranscription = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/transcribe-simple/${fileId}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setStatus('completed');
        setTranscript(data.transcript);
      } else {
        alert('Transcription failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error starting transcription:', error);
      alert('Failed to start transcription');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return 'Transcription Complete';
      case 'processing':
        return `Processing... ${progress}%`;
      case 'failed':
        return 'Transcription Failed';
      case 'pending':
        return 'Pending';
      default:
        return 'No Transcription';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm text-muted-foreground">{getStatusText()}</span>

        {(status === 'none' || status === 'failed') && (
          <Button
            size="sm"
            variant="outline"
            onClick={startTranscription}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Transcribe
              </>
            )}
          </Button>
        )}
      </div>

      {transcript && (
        <div className="mt-2 p-3 bg-muted rounded-md">
          <p className="text-sm">
            {Array.isArray(transcript)
              ? transcript.map((seg: any) => seg.text).join(' ')
              : transcript
            }
          </p>
        </div>
      )}
    </div>
  );
}
