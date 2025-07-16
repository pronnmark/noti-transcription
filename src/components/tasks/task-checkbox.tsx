'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskCheckboxProps {
  id: string;
  checked: boolean;
  onToggle: (id: string, completed: boolean) => Promise<void>;
  className?: string;
}

export function TaskCheckbox({ id, checked, onToggle, className }: TaskCheckboxProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (isToggling) return;
    
    setIsToggling(true);
    try {
      await onToggle(id, !checked);
    } catch (error) {
      toast.error('Failed to update task status');
      console.error('Error toggling task:', error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={handleToggle}
      disabled={isToggling}
      className={cn(
        "transition-all duration-200",
        isToggling && "opacity-50 cursor-not-allowed",
        className
      )}
    />
  );
}