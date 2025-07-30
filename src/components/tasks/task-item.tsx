'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TaskCheckbox } from './task-checkbox';
import { CommentForm } from './comment-form';
import { TranscriptLink } from './transcript-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

interface Note {
  id: string;
  fileId: number;
  noteType: 'task' | 'question' | 'decision' | 'followup' | 'mention';
  content: string;
  context?: string;
  speaker?: string;
  timestamp?: number;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'archived';
  comments?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskItemProps {
  note: Note;
  index: number;
  onToggleStatus: (id: string, completed: boolean) => Promise<void>;
  onUpdateComment: (id: string, comment: string) => Promise<void>;
  className?: string;
}

export function TaskItem({
  note,
  index,
  onToggleStatus,
  onUpdateComment,
  className,
}: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const isCompleted = note.status === 'completed';
  const hasContext = note.context && note.context.trim().length > 0;
  const hasComment = note.comments && note.comments.trim().length > 0;
  const hasTimestamp = note.timestamp !== undefined && note.timestamp !== null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (noteType: string) => {
    switch (noteType) {
      case 'task':
        return 'bg-blue-100 text-blue-800';
      case 'question':
        return 'bg-orange-100 text-orange-800';
      case 'decision':
        return 'bg-green-100 text-green-800';
      case 'followup':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isCompleted && 'opacity-60',
        className
      )}
    >
      <CardContent className={cn('p-4', isMobile ? 'space-y-3' : 'space-y-4')}>
        {/* Main task content */}
        <div className='flex items-start gap-3'>
          <div className='flex-shrink-0 pt-1'>
            <TaskCheckbox
              id={note.id}
              checked={isCompleted}
              onToggle={onToggleStatus}
            />
          </div>

          <div className='min-w-0 flex-1'>
            <div className='flex items-start justify-between gap-2'>
              <div className='min-w-0 flex-1'>
                <p
                  className={cn(
                    'text-sm font-medium leading-relaxed',
                    isCompleted && 'text-muted-foreground line-through'
                  )}
                >
                  {note.content}
                </p>

                {/* Metadata */}
                <div className='mt-2 flex flex-wrap items-center gap-2'>
                  <Badge
                    variant='outline'
                    className={cn('text-xs', getTypeColor(note.noteType))}
                  >
                    {note.noteType}
                  </Badge>
                  <Badge
                    variant='outline'
                    className={cn('text-xs', getPriorityColor(note.priority))}
                  >
                    {note.priority}
                  </Badge>
                  {isCompleted && note.completedAt && (
                    <Badge
                      variant='outline'
                      className='bg-green-50 text-xs text-green-700'
                    >
                      Completed
                    </Badge>
                  )}
                </div>
              </div>

              <div className='flex-shrink-0 text-right'>
                <div className='text-xs text-muted-foreground'>
                  #{index + 1}
                </div>
              </div>
            </div>

            {/* Timestamp and speaker info */}
            {(hasTimestamp || note.speaker) && (
              <div className='mt-3'>
                <TranscriptLink
                  fileId={note.fileId.toString()}
                  timestamp={note.timestamp}
                  speaker={note.speaker}
                />
              </div>
            )}

            {/* Expandable content */}
            {(hasContext || hasComment || !isExpanded) && (
              <div className='mt-3'>
                {(hasContext || hasComment) && !isExpanded && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setIsExpanded(true)}
                    className='text-muted-foreground hover:text-foreground'
                  >
                    <ChevronDown className='mr-2 h-4 w-4' />
                    Show details
                  </Button>
                )}

                {isExpanded && (
                  <div className='space-y-4 pt-2'>
                    {isExpanded && (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setIsExpanded(false)}
                        className='text-muted-foreground hover:text-foreground'
                      >
                        <ChevronUp className='mr-2 h-4 w-4' />
                        Hide details
                      </Button>
                    )}

                    {hasContext && (
                      <div className='space-y-2'>
                        <div className='text-sm font-medium text-muted-foreground'>
                          Context
                        </div>
                        <div className='rounded-lg border-l-2 border-muted bg-muted/50 p-3 text-sm text-muted-foreground'>
                          {note.context}
                        </div>
                      </div>
                    )}

                    {/* Comment form */}
                    <CommentForm
                      noteId={note.id}
                      initialComment={note.comments}
                      onSave={onUpdateComment}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Always show comment form if expanded or no other expandable content */}
            {!hasContext && !hasComment && (
              <div className='mt-3'>
                <CommentForm
                  noteId={note.id}
                  initialComment={note.comments}
                  onSave={onUpdateComment}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
