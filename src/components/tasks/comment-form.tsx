'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Save, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CommentFormProps {
  noteId: string;
  initialComment?: string;
  onSave: (noteId: string, comment: string) => Promise<void>;
  className?: string;
}

export function CommentForm({ noteId, initialComment = '', onSave, className }: CommentFormProps) {
  const [comment, setComment] = useState(initialComment);
  const [isEditing, setIsEditing] = useState(!initialComment);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!comment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(noteId, comment.trim());
      setIsEditing(false);
      toast.success('Comment saved');
    } catch (error) {
      toast.error('Failed to save comment');
      console.error('Error saving comment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setComment(initialComment);
    setIsEditing(false);
  };

  if (!isEditing && !initialComment) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditing(true)}
        className={cn('text-muted-foreground hover:text-foreground', className)}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Add comment
      </Button>
    );
  }

  if (!isEditing) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Comment</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        </div>
        <div className="pl-6 text-sm text-muted-foreground border-l-2 border-muted">
          {initialComment}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {initialComment ? 'Edit comment' : 'Add comment'}
        </span>
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add your notes, observations, or updates..."
        className="min-h-[80px] resize-none"
        disabled={isSaving}
      />
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving || !comment.trim()}
          size="sm"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
          size="sm"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
