'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, Brain, FileText, Settings } from 'lucide-react';

interface AIModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
}

interface AIProcessingPanelProps {
  fileId: number;
  fileName: string;
  hasTranscript: boolean;
  currentStatuses: {
    summarization?: 'pending' | 'processing' | 'completed' | 'failed';
  };
  onProcessingComplete?: () => void;
}

export default function AIProcessingPanel({
  fileId,
  fileName,
  hasTranscript,
  currentStatuses,
  onProcessingComplete,
}: AIProcessingPanelProps) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(
    'anthropic/claude-sonnet-4'
  );
  const [processing, setProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load available models
      const modelsResponse = await fetch('/api/ai/models');
      const modelsData = await modelsResponse.json();
      setModels(modelsData.models || []);
    } catch (error) {
      console.error('Error loading AI processing data:', error);
    }
  };

  const handleProcess = async (type: string) => {
    if (!hasTranscript) {
      alert('File must be transcribed first');
      return;
    }

    setProcessing(true);
    setProcessingType(type);

    try {
      const payload: any = {
        processType: type,
        model: selectedModel,
      };

      const response = await fetch(`/api/ai/process/${fileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Processing failed');
      }

      // Call completion handler if provided
      if (onProcessingComplete) {
        onProcessingComplete();
      }
    } catch (error) {
      console.error('Error processing:', error);
      alert('Processing failed. Please try again.');
    } finally {
      setProcessing(false);
      setProcessingType('');
    }
  };

  const getStatusColor = (
    status?: 'pending' | 'processing' | 'completed' | 'failed'
  ) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const isProcessingType = (type: string) => {
    return processing && processingType === type;
  };

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='flex items-center space-x-2'>
          <Brain className='h-5 w-5' />
          <span>AI Processing</span>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Status Display */}
        <div className='grid grid-cols-1 gap-4'>
          <div className='flex flex-col items-center rounded-lg border p-4'>
            <div className='mb-2 flex items-center justify-center space-x-2'>
              <FileText className='h-4 w-4' />
              <span className='text-sm font-medium'>Summarization</span>
            </div>
            <Badge className={getStatusColor(currentStatuses.summarization)}>
              {currentStatuses.summarization || 'pending'}
            </Badge>
          </div>
        </div>

        {/* Model Selection */}
        <div className='space-y-4'>
          <div>
            <Label htmlFor='model-select' className='mb-2 block'>
              AI Model
            </Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
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
          </div>
        </div>

        {/* Processing Buttons */}
        <div className='flex flex-col space-y-2'>
          <Button
            onClick={() => handleProcess('summarization')}
            disabled={!hasTranscript || processing}
            className='w-full'
          >
            {isProcessingType('summarization') ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <FileText className='mr-2 h-4 w-4' />
            )}
            Generate Summary
          </Button>
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
