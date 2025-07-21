'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LabelEditorProps {
  labels: string[];
  onChange: (labels: string[]) => void;
  placeholder?: string;
  maxLabels?: number;
  className?: string;
  disabled?: boolean;
}

interface LabelSuggestion {
  label: string;
  count: number;
}

const LABEL_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-red-100 text-red-800 border-red-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
];

export function LabelEditor({
  labels,
  onChange,
  placeholder = "Add labels...",
  maxLabels = 10,
  className,
  disabled = false
}: LabelEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [suggestions, setSuggestions] = useState<LabelSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Color assignment based on label text
  const getLabelColor = (label: string) => {
    const hash = label.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
  };

  // Fetch label suggestions
  const fetchSuggestions = async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/labels?q=${encodeURIComponent(query)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.labels || []);
      }
    } catch (error) {
      console.error('Error fetching label suggestions:', error);
    }
  };

  // Debounced suggestion fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim()) {
        fetchSuggestions(inputValue.trim());
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsEditing(false);
        setShowSuggestions(false);
        setInputValue('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addLabel = (label: string) => {
    const trimmedLabel = label.trim();
    if (trimmedLabel && !labels.includes(trimmedLabel) && labels.length < maxLabels) {
      onChange([...labels, trimmedLabel]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeLabel = (labelToRemove: string) => {
    onChange(labels.filter(label => label !== labelToRemove));
  };

  const handleInputSubmit = () => {
    if (inputValue.trim()) {
      addLabel(inputValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const filteredSuggestions = suggestions.filter(
    suggestion => !labels.includes(suggestion.label)
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {/* Existing Labels */}
        {labels.map((label) => (
          <Badge
            key={label}
            variant="secondary"
            className={cn(
              "text-xs border",
              getLabelColor(label),
              !disabled && "group hover:pr-1 transition-all"
            )}
          >
            <Tag className="w-3 h-3 mr-1" />
            {label}
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-3 w-3 p-0 opacity-0 group-hover:opacity-100 hover:bg-transparent"
                onClick={() => removeLabel(label)}
              >
                <X className="w-2 h-2" />
              </Button>
            )}
          </Badge>
        ))}

        {/* Add Label Input/Button */}
        {!disabled && labels.length < maxLabels && (
          <>
            {isEditing ? (
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={placeholder}
                  className="h-6 text-xs w-32 px-2"
                  autoFocus
                />
                
                {/* Suggestions Dropdown */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border rounded-md shadow-lg z-50 max-h-32 overflow-y-auto">
                    {filteredSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        className="w-full text-left px-3 py-1 text-xs hover:bg-gray-50 flex items-center justify-between"
                        onClick={() => addLabel(suggestion.label)}
                      >
                        <span>{suggestion.label}</span>
                        <span className="text-gray-400 text-xs">({suggestion.count})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setIsEditing(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add label
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}