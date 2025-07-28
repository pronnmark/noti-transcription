'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, Share, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TranscriptSegment {
  speaker?: string;
  text: string;
  start?: number;
  end?: number;
}

interface TranscriptViewerProps {
  transcript: string | null;
  fileName?: string;
  speakerCount?: number;
  fileId?: number | null;
  onStartNewRecording: () => void;
  className?: string;
}

export function TranscriptViewer({
  transcript,
  fileName = 'Recording',
  speakerCount = 2,
  fileId,
  onStartNewRecording,
  className,
}: TranscriptViewerProps) {
  const [showTimestamps, setShowTimestamps] = useState(false);

  if (!transcript) {
    return null;
  }

  // Parse transcript - handle both JSON speaker format and plain text
  const parseTranscript = (text: string | null | undefined): TranscriptSegment[] => {
    // Ensure we have a valid string
    if (!text || typeof text !== 'string') {
      return [{ text: 'No transcript available' }];
    }

    try {
      // Try to parse as JSON first (speaker diarization format)
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((segment: any) => ({
          speaker: segment.speaker || 'Speaker',
          text: segment.text || '',
          start: segment.start,
          end: segment.end,
        }));
      }
    } catch {
      // Fall back to plain text - split by paragraphs or sentences
      const sentences = text.split(/\n\n|\. /).filter(s => s.trim());
      if (sentences.length === 0) {
        return [{ text: text.trim() || 'Empty transcript' }];
      }
      return sentences.map((sentence, index) => ({
        text: sentence.trim() + (sentence.endsWith('.') ? '' : '.'),
        speaker: speakerCount > 1 ? `Speaker ${(index % speakerCount) + 1}` : undefined,
      }));
    }

    return [{ text }];
  };

  const segments = parseTranscript(transcript);
  const hasMultipleSpeakers = segments.some(s => s.speaker);

  const copyToClipboard = async () => {
    try {
      const plainText = segments.map(s => 
        s.speaker ? `${s.speaker}: ${s.text}` : s.text
      ).join('\n\n');
      
      await navigator.clipboard.writeText(plainText);
      toast.success('Transcript copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy transcript');
    }
  };

  const downloadTranscript = () => {
    const plainText = segments.map(s => 
      s.speaker ? `${s.speaker}: ${s.text}` : s.text
    ).join('\n\n');
    
    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}-transcript.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Transcript downloaded');
  };

  const formatTimestamp = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSpeakerColor = (speaker?: string) => {
    if (!speaker) return '';
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800', 
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
    ];
    const hash = speaker.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Transcript</CardTitle>
          <div className="flex items-center gap-2">
            {hasMultipleSpeakers && (
              <Badge variant="secondary">
                {speakerCount} Speaker{speakerCount > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="outline">
              {segments.length} Segment{segments.length > 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
        
        {fileName && (
          <p className="text-muted-foreground text-sm">
            📁 {fileName}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="text-xs"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
          
          <Button
            variant="outline" 
            size="sm"
            onClick={downloadTranscript}
            className="text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>

          {fileId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Share feature coming soon!')}
              className="text-xs"
            >
              <Share className="h-3 w-3 mr-1" />
              Share
            </Button>
          )}

          {hasMultipleSpeakers && segments.some(s => s.start) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTimestamps(!showTimestamps)}
              className="text-xs"
            >
              {showTimestamps ? 'Hide' : 'Show'} Timestamps
            </Button>
          )}
        </div>

        {/* Transcript Content */}
        <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4 bg-muted/30">
          {segments.map((segment, index) => (
            <div key={index} className="space-y-2">
              {segment.speaker && (
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="secondary" 
                    className={cn('text-xs', getSpeakerColor(segment.speaker))}
                  >
                    {segment.speaker}
                  </Badge>
                  {showTimestamps && segment.start && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTimestamp(segment.start)}
                      {segment.end && ` - ${formatTimestamp(segment.end)}`}
                    </span>
                  )}
                </div>
              )}
              <p className="text-sm leading-relaxed pl-2 border-l-2 border-muted">
                {segment.text}
              </p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-center pt-4 border-t">
          <Button
            onClick={onStartNewRecording}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Record Another
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}