'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Brain, FileText, Settings, AlertTriangle } from 'lucide-react';
import { useAIProcessing } from '@/hooks';
import { toast } from 'sonner';

interface AIProcessingPanelProps {
  fileId: number;
  fileName: string;
  hasTranscript: boolean;
  currentStatuses?: {
    summarization?: 'pending' | 'processing' | 'completed' | 'failed';
  };
  onProcessingComplete?: () => void;
}

export default function AIProcessingPanel({
  fileId,
  fileName,
  hasTranscript,
  currentStatuses = {},
  onProcessingComplete,
}: AIProcessingPanelProps) {
  // Custom hook for AI processing functionality
  const {
    models,
    selectedModel,
    processing,
    processingType,
    processingStatus,
    modelsLoading,
    error,
    setSelectedModel,
    processFile,
    getStatusColor,
    isProcessingType,
    canProcess,
    hasModels,
    selectedModelInfo,
    updateProcessingStatus,
  } = useAIProcessing(fileId, hasTranscript);

  // Initialize processing status with current statuses
  useState(() => {
    if (currentStatuses) {
      updateProcessingStatus(currentStatuses);
    }
  });

  const handleProcess = async (type: string) => {
    try {
      await processFile(type);
      toast.success(`${type} completed successfully!`);
      
      // Call completion handler if provided
      if (onProcessingComplete) {
        onProcessingComplete();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      toast.error(errorMessage);
    }
  };

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='flex items-center space-x-2'>
          <Brain className='h-5 w-5' />
          <span>AI Processing</span>
          {fileName && (
            <span className='text-sm font-normal text-muted-foreground'>
              • {fileName}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Error Display */}
        {error && (
          <div className='flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive'>
            <AlertTriangle className='h-4 w-4' />
            <span className='text-sm'>{error}</span>
          </div>
        )}

        {/* Status Display */}
        <div className='grid grid-cols-1 gap-4'>
          <div className='flex flex-col items-center rounded-lg border p-4'>
            <div className='mb-2 flex items-center justify-center space-x-2'>
              <FileText className='h-4 w-4' />
              <span className='text-sm font-medium'>Summarization</span>
            </div>
            <Badge className={getStatusColor(
              processingStatus.summarization || currentStatuses.summarization
            )}>
              {processingStatus.summarization || currentStatuses.summarization || 'pending'}
            </Badge>
          </div>
        </div>

        {/* Model Selection */}
        <div className='space-y-4'>
          <div>
            <Label htmlFor='model-select' className='mb-2 block'>
              AI Model
            </Label>
            {modelsLoading ? (
              <div className='flex items-center gap-2 rounded-md border p-3'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span className='text-sm text-muted-foreground'>Loading models...</span>
              </div>
            ) : !hasModels ? (
              <div className='flex items-center gap-2 rounded-md border p-3 text-muted-foreground'>
                <AlertTriangle className='h-4 w-4' />
                <span className='text-sm'>No models available</span>
              </div>
            ) : (
              <Select 
                value={selectedModel} 
                onValueChange={setSelectedModel}
                disabled={processing}
              >
                <SelectTrigger id='model-select'>
                  <SelectValue placeholder='Select a model' />
                </SelectTrigger>
                <SelectContent>
                  {models.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div>
                        <div className='font-medium'>{model.name}</div>
                        <div className='text-xs text-muted-foreground'>
                          {model.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Show selected model info */}
            {selectedModelInfo && (
              <div className='mt-2 text-xs text-muted-foreground'>
                Context window: {selectedModelInfo.contextWindow.toLocaleString()} tokens
              </div>
            )}
          </div>
        </div>

        {/* Processing Buttons */}
        <div className='flex flex-col space-y-2'>
          <Button
            onClick={() => handleProcess('summarization')}
            disabled={!canProcess}
            className='w-full'
          >
            {isProcessingType('summarization') ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <FileText className='mr-2 h-4 w-4' />
            )}
            Generate Summary
          </Button>
          
          {/* Transcript requirement notice */}
          {!hasTranscript && (
            <div className='flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground'>
              <AlertTriangle className='h-4 w-4' />
              <span>File must be transcribed first</span>
            </div>
          )}
        </div>

        {/* Settings Link */}
        <div className='mt-4 text-center'>
          <a
            href='/settings'
            className='inline-flex items-center text-sm text-muted-foreground hover:text-foreground'
          >
            <Settings className='mr-1 h-4 w-4' />
            Configure AI settings
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
