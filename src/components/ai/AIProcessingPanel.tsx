'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Brain, FileText, BarChart3, Sparkles, Settings } from 'lucide-react';

interface AIModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
}

interface AIProcessingPanelProps {
  fileId: number;
  fileName: string;
  hasTranscript: boolean;
  currentStatuses: {
    summarization?: 'pending' | 'processing' | 'completed' | 'failed';
    extraction?: 'pending' | 'processing' | 'completed' | 'failed';
    dataPoint?: 'pending' | 'processing' | 'completed' | 'failed';
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
  const [extractionTemplates, setExtractionTemplates] = useState<Template[]>([]);
  const [dataPointTemplates, setDataPointTemplates] = useState<Template[]>([]);
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-sonnet-4');
  const [selectedExtractionTemplates, setSelectedExtractionTemplates] = useState<string[]>([]);
  const [selectedDataPointTemplates, setSelectedDataPointTemplates] = useState<string[]>([]);
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

      // Load extraction templates
      const extractionResponse = await fetch('/api/extractions/templates?activeOnly=true');
      const extractionData = await extractionResponse.json();
      setExtractionTemplates(extractionData.templates || []);

      // Load data point templates
      const dataPointResponse = await fetch('/api/data-points/templates?activeOnly=true');
      const dataPointData = await dataPointResponse.json();
      setDataPointTemplates(dataPointData.templates || []);

      // Set default selections
      const defaultExtractions = extractionData.templates?.filter((t: Template) => t.isDefault).map((t: Template) => t.id) || [];
      const defaultDataPoints = dataPointData.templates?.filter((t: Template) => t.isDefault).map((t: Template) => t.id) || [];

      setSelectedExtractionTemplates(defaultExtractions);
      setSelectedDataPointTemplates(defaultDataPoints);
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
        temperature: 0.3,
      };

      if (type === 'extractions' || type === 'all') {
        payload.templateIds = selectedExtractionTemplates;
      }
      if (type === 'datapoints' || type === 'all') {
        payload.templateIds = type === 'all' ?
          [...selectedExtractionTemplates, ...selectedDataPointTemplates] :
          selectedDataPointTemplates;
      }

      const response = await fetch(`/api/ai/process/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('AI processing completed:', result);
        onProcessingComplete?.();
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      console.error('AI processing error:', error);
      alert(`Processing failed: ${error}`);
    } finally {
      setProcessing(false);
      setProcessingType('');
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isProcessingType = (type: string) => processing && processingType === type;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-blue-500" />
          <span>AI Processing</span>
          <Badge variant="outline" className="ml-auto">
            {fileName}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">Summarization</span>
            </div>
            <Badge className={getStatusColor(currentStatuses.summarization)}>
              {currentStatuses.summarization || 'pending'}
            </Badge>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Extractions</span>
            </div>
            <Badge className={getStatusColor(currentStatuses.extraction)}>
              {currentStatuses.extraction || 'pending'}
            </Badge>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm font-medium">Data Points</span>
            </div>
            <Badge className={getStatusColor(currentStatuses.dataPoint)}>
              {currentStatuses.dataPoint || 'pending'}
            </Badge>
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <Label htmlFor="model-select">AI Model</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-gray-500">{model.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Template Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Extraction Templates</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
              {extractionTemplates.map((template) => (
                <div key={template.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`ext-${template.id}`}
                    checked={selectedExtractionTemplates.includes(template.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedExtractionTemplates([...selectedExtractionTemplates, template.id]);
                      } else {
                        setSelectedExtractionTemplates(selectedExtractionTemplates.filter(id => id !== template.id));
                      }
                    }}
                  />
                  <Label htmlFor={`ext-${template.id}`} className="text-sm">
                    {template.name}
                    {template.isDefault && <Badge variant="outline" className="ml-1 text-xs">Default</Badge>}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Data Point Templates</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
              {dataPointTemplates.map((template) => (
                <div key={template.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dp-${template.id}`}
                    checked={selectedDataPointTemplates.includes(template.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedDataPointTemplates([...selectedDataPointTemplates, template.id]);
                      } else {
                        setSelectedDataPointTemplates(selectedDataPointTemplates.filter(id => id !== template.id));
                      }
                    }}
                  />
                  <Label htmlFor={`dp-${template.id}`} className="text-sm">
                    {template.name}
                    {template.isDefault && <Badge variant="outline" className="ml-1 text-xs">Default</Badge>}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Processing Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => handleProcess('summarization')}
            disabled={!hasTranscript || processing}
            variant="outline"
            className="w-full"
          >
            {isProcessingType('summarization') ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Summarize
          </Button>

          <Button
            onClick={() => handleProcess('extractions')}
            disabled={!hasTranscript || processing || selectedExtractionTemplates.length === 0}
            variant="outline"
            className="w-full"
          >
            {isProcessingType('extractions') ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Extract
          </Button>

          <Button
            onClick={() => handleProcess('datapoints')}
            disabled={!hasTranscript || processing || selectedDataPointTemplates.length === 0}
            variant="outline"
            className="w-full"
          >
            {isProcessingType('datapoints') ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <BarChart3 className="w-4 h-4 mr-2" />
            )}
            Analyze
          </Button>

          <Button
            onClick={() => handleProcess('all')}
            disabled={!hasTranscript || processing}
            className="w-full"
          >
            {isProcessingType('all') ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Brain className="w-4 h-4 mr-2" />
            )}
            Process All
          </Button>
        </div>

        {!hasTranscript && (
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              This file needs to be transcribed before AI processing can begin.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
