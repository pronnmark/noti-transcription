import { useState, useEffect, useCallback } from 'react';

export interface AIModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
}

export interface ProcessingStatus {
  summarization?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ProcessingOptions {
  model: string;
  processType: string;
}

/**
 * Custom hook for AI processing functionality
 * Handles model loading, processing status, and AI operations
 */
export function useAIProcessing(fileId: number, hasTranscript: boolean) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-sonnet-4');
  const [processing, setProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({});
  const [modelsLoading, setModelsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available AI models
  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ai/models');
      if (!response.ok) {
        throw new Error(`Failed to load models: ${response.status}`);
      }
      
      const data = await response.json();
      setModels(data.models || []);
      
      // Set default model if available
      if (data.models && data.models.length > 0 && !selectedModel) {
        setSelectedModel(data.models[0].id);
      }
    } catch (error) {
      console.error('Error loading AI models:', error);
      setError(error instanceof Error ? error.message : 'Failed to load AI models');
    } finally {
      setModelsLoading(false);
    }
  }, [selectedModel]);

  // Process file with AI
  const processFile = useCallback(
    async (processType: string, options?: Partial<ProcessingOptions>) => {
      if (!hasTranscript) {
        throw new Error('File must be transcribed first');
      }

      if (!fileId) {
        throw new Error('Invalid file ID');
      }

      setProcessing(true);
      setProcessingType(processType);
      setError(null);

      try {
        const payload = {
          processType,
          model: options?.model || selectedModel,
          ...options,
        };

        const response = await fetch(`/api/ai/process/${fileId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Processing failed: ${response.status}`
          );
        }

        const result = await response.json();
        
        // Update processing status
        setProcessingStatus(prev => ({
          ...prev,
          [processType]: 'completed',
        }));

        return result;
      } catch (error) {
        console.error('Error processing file:', error);
        const errorMessage = error instanceof Error ? error.message : 'Processing failed';
        setError(errorMessage);
        
        // Update processing status to failed
        setProcessingStatus(prev => ({
          ...prev,
          [processType]: 'failed',
        }));
        
        throw error;
      } finally {
        setProcessing(false);
        setProcessingType('');
      }
    },
    [fileId, hasTranscript, selectedModel]
  );

  // Get status color for UI display
  const getStatusColor = useCallback(
    (status?: 'pending' | 'processing' | 'completed' | 'failed') => {
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
    },
    []
  );

  // Check if currently processing a specific type
  const isProcessingType = useCallback(
    (type: string) => {
      return processing && processingType === type;
    },
    [processing, processingType]
  );

  // Get model by ID
  const getModelById = useCallback(
    (modelId: string) => {
      return models.find(model => model.id === modelId);
    },
    [models]
  );

  // Update processing status externally
  const updateProcessingStatus = useCallback((newStatus: ProcessingStatus) => {
    setProcessingStatus(prev => ({ ...prev, ...newStatus }));
  }, []);

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return {
    // State
    models,
    selectedModel,
    processing,
    processingType,
    processingStatus,
    modelsLoading,
    error,

    // Actions
    setSelectedModel,
    processFile,
    loadModels,
    updateProcessingStatus,

    // Utilities
    getStatusColor,
    isProcessingType,
    getModelById,

    // Computed values
    hasModels: models.length > 0,
    canProcess: hasTranscript && !processing && !modelsLoading,
    selectedModelInfo: getModelById(selectedModel),
  };
}