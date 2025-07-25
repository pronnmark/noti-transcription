'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UnibodyCard } from './unibody-card';
import { LabelEditor } from './label-editor';
import { Button } from './button';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Clock3,
  FileAudio,
  MoreHorizontal,
  Loader2,
  Edit3,
  Trash2,
  Eye,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';

interface AudioFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  recordedAt?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'error';
  hasTranscript?: boolean;
  hasAiExtract?: boolean;
  extractCount?: number;
  duration?: number;
  labels?: string[];
  notesStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  notesCount?: any;
  speakerCount?: number;
  diarizationStatus?: 'not_attempted' | 'in_progress' | 'success' | 'failed' | 'no_speakers_detected';
  hasSpeakers?: boolean;
  diarizationError?: string;
}

interface MobileFileCardProps {
  file: AudioFile;
  onExtract?: (fileId: string, fileName: string) => void;
  onDelete?: (fileId: string, fileName: string) => void;
  onRename?: (fileId: string, fileName: string) => void;
  onLabelsUpdate?: (fileId: string, labels: string[]) => void;
  isExtracting?: boolean;
  isDeleting?: boolean;
  showActions?: boolean;
}

/**
 * iOS-native mobile file card following Design Buzz philosophy
 * - Unibody construction with purposeful elements
 * - Effortless interaction hiding complexity
 * - Clear hierarchy with single accent color
 */
export function MobileFileCard({
  file,
  onExtract,
  onDelete,
  onRename,
  onLabelsUpdate,
  isExtracting = false,
  isDeleting = false,
}: MobileFileCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Format utilities following iOS patterns
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 10) / 10} ${sizes[i]}`;
  };

  const formatRecordingDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRecordingTime = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Status indicators with iOS-style iconography
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <UnibodyCard interactive className="space-y-3">
      {/* File identity - Purposeful hierarchy */}
      <div className="space-y-1.5">
        {file.hasTranscript ? (
          <button
            onClick={() => window.location.href = `/transcript/${file.id}`}
            className="text-left w-full group"
          >
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 leading-snug">
              {file.originalName}
            </h3>
          </button>
        ) : (
          <h3 className="text-base font-semibold text-gray-900 leading-snug">
            {file.originalName}
          </h3>
        )}

        {/* Essential metadata - Clean hierarchy */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-600 font-medium">
              {formatDuration(file.duration)}
            </span>
            <span className="text-xs text-gray-400">
              {formatFileSize(file.size)}
            </span>
          </div>

          {/* Status - Minimal visual weight */}
          <div className="flex items-center gap-1.5">
            {getStatusIcon(file.transcriptionStatus)}
            <span className="text-xs text-gray-500">
              {file.transcriptionStatus || 'pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Recording time - Contextual information */}
      {file.recordedAt && (
        <div className="text-xs text-gray-400">
          {formatRecordingDate(file.recordedAt)} at {formatRecordingTime(file.recordedAt)}
        </div>
      )}

      {/* Speaker information - Show when available */}
      {file.speakerCount && file.diarizationStatus === 'success' && (
        <div className="text-xs text-blue-600 font-medium">
          {file.speakerCount} speaker{file.speakerCount > 1 ? 's' : ''} detected
        </div>
      )}

      {/* Processing status - Minimal indicators */}
      {file.transcriptionStatus === 'completed' && file.extractCount && file.extractCount > 0 && (
        <div className="text-xs text-gray-400">
          {file.extractCount} summary{file.extractCount > 1 ? 'ies' : 'y'} available
        </div>
      )}

      {/* Labels - Contextual organization */}
      {onLabelsUpdate && (
        <LabelEditor
          labels={file.labels || []}
          onChange={(labels) => onLabelsUpdate(file.id, labels)}
          placeholder="Add labels..."
          className="w-full"
        />
      )}

      {/* Actions - Purposeful and minimal */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex-1">
          {file.transcriptionStatus === 'completed' && !file.hasAiExtract ? (
            <Button
              onClick={() => onExtract?.(file.id, file.originalName)}
              disabled={isExtracting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg touch-target-44"
            >
              {isExtracting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {isExtracting ? 'Processing...' : 'Summarize'}
            </Button>
          ) : file.hasAiExtract ? (
            <Button
              onClick={() => window.location.href = `/ai/summarization`}
              variant="outline"
              className="w-full border-gray-200 text-gray-600 font-medium py-2.5 rounded-lg touch-target-44"
            >
                View Summaries
            </Button>
          ) : (
            <div className="text-center text-sm text-gray-400 py-2.5">
              {file.transcriptionStatus === 'processing' ? 'Processing...' : 'Transcribing...'}
            </div>
          )}
        </div>

        {/* Secondary actions - Minimal visual weight */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 ml-2 rounded-lg touch-target-44 text-gray-400 hover:text-gray-600"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {file.hasTranscript && (
              <DropdownMenuItem onClick={() => window.location.href = `/transcript/${file.id}`}>
                  View Transcript
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onRename?.(file.id, file.originalName)}>
                Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete?.(file.id, file.originalName)}
              disabled={isDeleting}
              className="text-red-600 focus:text-red-600"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </UnibodyCard>
  );
}
