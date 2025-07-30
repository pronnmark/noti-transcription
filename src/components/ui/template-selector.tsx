'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Settings } from 'lucide-react';
import { toast } from 'sonner';

export interface Template {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  isDefault?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateSelectorProps {
  /** Template type to load (determines API endpoint) */
  templateType: 'summarization';
  /** Currently selected template ID */
  selectedTemplateId?: string;
  /** Callback when template selection changes */
  onTemplateSelect: (template: Template | null) => void;
  /** Allow multiple template selection */
  multiple?: boolean;
  /** Selected template IDs for multiple selection */
  selectedTemplateIds?: string[];
  /** Callback for multiple selection */
  onMultipleSelect?: (templates: Template[]) => void;
  /** Show template management button */
  showManagement?: boolean;
  /** Callback when management button is clicked */
  onManagementClick?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Component size */
  size?: 'sm' | 'md' | 'lg';
  /** Disabled state */
  disabled?: boolean;
  /** Custom CSS classes */
  className?: string;
}

const API_ENDPOINTS = {
  summarization: '/api/summarization-prompts',
};

export function TemplateSelector({
  templateType,
  selectedTemplateId,
  onTemplateSelect,
  multiple = false,
  selectedTemplateIds = [],
  onMultipleSelect,
  showManagement = false,
  onManagementClick,
  placeholder = 'Select template...',
  size = 'md',
  disabled = false,
  className = '',
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, [templateType]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = API_ENDPOINTS[templateType];
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to load templates: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different response formats
      let templateList: Template[] = [];
      if (templateType === 'summarization') {
        templateList = data.prompts || data || [];
      } else {
        templateList = Array.isArray(data) ? data : data.templates || [];
      }

      // Ensure templates have required fields
      const formattedTemplates = templateList.map((template: any) => ({
        id: template.id,
        name: template.name || template.title || 'Untitled',
        description: template.description,
        prompt: template.prompt,
        isDefault: template.isDefault || template.is_default || false,
        isActive: template.isActive || template.is_active !== false, // Default to true if not specified
        createdAt: template.createdAt || template.created_at,
        updatedAt: template.updatedAt || template.updated_at,
      }));

      setTemplates(formattedTemplates);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleSelection = (templateId: string) => {
    if (templateId === 'none') {
      onTemplateSelect(null);
      return;
    }

    const template = templates.find(t => t.id === templateId);
    onTemplateSelect(template || null);
  };

  const handleMultipleSelection = (templateId: string, checked: boolean) => {
    if (!onMultipleSelect) return;

    let newSelectedIds: string[];
    if (checked) {
      newSelectedIds = [...selectedTemplateIds, templateId];
    } else {
      newSelectedIds = selectedTemplateIds.filter(id => id !== templateId);
    }

    const selectedTemplates = templates.filter(t =>
      newSelectedIds.includes(t.id)
    );
    onMultipleSelect(selectedTemplates);
  };

  // Get display text for selected templates
  const getDisplayText = () => {
    if (multiple) {
      if (selectedTemplateIds.length === 0) return placeholder;
      if (selectedTemplateIds.length === 1) {
        const template = templates.find(t => t.id === selectedTemplateIds[0]);
        return template?.name || 'Unknown template';
      }
      return `${selectedTemplateIds.length} templates selected`;
    } else {
      if (!selectedTemplateId) return placeholder;
      const template = templates.find(t => t.id === selectedTemplateId);
      return template?.name || 'Unknown template';
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className='h-4 w-4 animate-spin' />
        <span className='text-sm text-muted-foreground'>
          Loading templates...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-sm text-red-600 ${className}`}>
        Error: {error}
        <Button
          variant='ghost'
          size='sm'
          onClick={loadTemplates}
          className='ml-2 h-6 px-2'
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {multiple ? (
        // Multiple selection with checkboxes
        <div className='space-y-2'>
          <div className='text-sm font-medium'>Select templates:</div>
          <div className='max-h-32 space-y-1 overflow-y-auto'>
            {templates.map(template => (
              <label
                key={template.id}
                className='flex cursor-pointer items-center gap-2'
              >
                <input
                  type='checkbox'
                  checked={selectedTemplateIds.includes(template.id)}
                  onChange={e =>
                    handleMultipleSelection(template.id, e.target.checked)
                  }
                  disabled={disabled}
                  className='rounded border-gray-300'
                />
                <div className='min-w-0 flex-1'>
                  <div className='text-sm font-medium'>{template.name}</div>
                  {template.description && (
                    <div className='truncate text-xs text-muted-foreground'>
                      {template.description}
                    </div>
                  )}
                </div>
                {template.isDefault && (
                  <Badge variant='outline' className='text-xs'>
                    Default
                  </Badge>
                )}
              </label>
            ))}
          </div>
        </div>
      ) : (
        // Single selection dropdown
        <Select
          value={selectedTemplateId || 'none'}
          onValueChange={handleSingleSelection}
          disabled={disabled}
        >
          <SelectTrigger className={`${sizeClasses[size]} flex-1`}>
            <SelectValue placeholder={placeholder}>
              {getDisplayText()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='none'>
              <span className='text-muted-foreground'>No template</span>
            </SelectItem>
            {templates.map(template => (
              <SelectItem key={template.id} value={template.id}>
                <div className='flex w-full items-center justify-between'>
                  <div className='min-w-0 flex-1'>
                    <div className='font-medium'>{template.name}</div>
                    {template.description && (
                      <div className='truncate text-xs text-muted-foreground'>
                        {template.description}
                      </div>
                    )}
                  </div>
                  {template.isDefault && (
                    <Badge variant='outline' className='ml-2 text-xs'>
                      Default
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showManagement && onManagementClick && (
        <Button
          variant='outline'
          size={size === 'sm' ? 'sm' : 'default'}
          onClick={onManagementClick}
          disabled={disabled}
          className='flex-shrink-0'
        >
          <Settings className='h-4 w-4' />
          {size !== 'sm' && <span className='ml-2'>Manage</span>}
        </Button>
      )}
    </div>
  );
}
