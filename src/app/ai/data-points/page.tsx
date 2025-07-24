'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, BarChart3, Settings, TrendingUp, Activity } from 'lucide-react';
import { toast } from 'sonner';
import TemplateManager from '@/components/templates/TemplateManager';

interface DataPointTemplate {
  id: string;
  name: string;
  description: string;
  visualization_type: 'chart' | 'gauge' | 'text' | 'mixed';
  is_active: boolean;
  is_default: boolean;
  output_schema: string;
  created_at: string;
  updated_at: string;
}

interface DataPoint {
  id: string;
  file_id: number;
  template_id: string;
  analysis_results: Record<string, unknown>;
  created_at: string;
}

interface AudioFile {
  id: number;
  fileName: string;
  originalFileName: string;
  dataPointStatus: 'pending' | 'processing' | 'completed' | 'failed';
  dataPointTemplatesUsed: string[];
  uploadedAt: string;
}

export default function DataPointsPage() {
  const [templates, setTemplates] = useState<DataPointTemplate[]>([]);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');
  const [_selectedFile, _setSelectedFile] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  const loadData = async () => {
    try {
      // Load data point templates
      const templatesResponse = await fetch('/api/data-points/templates');
      const templatesData = await templatesResponse.json();
      setTemplates(templatesData.templates || []);

      // Load files with data point status
      const filesResponse = await fetch('/api/files');
      const filesData = await filesResponse.json();
      setFiles(filesData.files || []);

      // Load data points
      const dataPointsResponse = await fetch('/api/data-points');
      const dataPointsData = await dataPointsResponse.json();
      setDataPoints(dataPointsData.dataPoints || []);
    } catch (_error) {
      // Error already shown via toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeTemplates = templates.filter(t => t.is_active);
  const defaultTemplates = templates.filter(t => t.is_default);

  const filteredDataPoints = dataPoints.filter(dataPoint => {
    if (selectedTemplate === 'all') return true;
    return dataPoint.template_id === selectedTemplate;
  });

  const getTemplateName = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    return template?.name || 'Unknown Template';
  };

  const getVisualizationIcon = (type: string) => {
    switch (type) {
      case 'chart':
        return <BarChart3 className="w-4 h-4" />;
      case 'gauge':
        return <Activity className="w-4 h-4" />;
      case 'text':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
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

  const handleRunAnalysis = async (fileId: number, templateIds: string[]) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/data-points/run/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateIds: templateIds,
        }),
      });

      if (response.ok) {
        // Refresh data
        const dataPointsResponse = await fetch('/api/data-points');
        const dataPointsData = await dataPointsResponse.json();
        setDataPoints(dataPointsData.dataPoints || []);
      }
    } catch (_error) {
      toast.error('Failed to run analysis');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderDataPointVisualization = (dataPoint: DataPoint) => {
    const template = templates.find(t => t.id === dataPoint.template_id);
    const results = dataPoint.analysis_results;

    if (!template || !results) return null;

    switch (template.visualization_type) {
      case 'gauge':
        return (
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(results).map(([key, value]) => (
              <div key={key} className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {typeof value === 'number' ? value : JSON.stringify(value)}
                </div>
                <div className="text-sm text-gray-600 capitalize">{key.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        );
      case 'text':
        return (
          <div className="space-y-2">
            {Object.entries(results).map(([key, value]) => (
              <div key={key}>
                <strong className="text-sm capitalize">{key.replace('_', ' ')}:</strong>
                <span className="ml-2 text-sm text-gray-700">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        );
      default:
        return (
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Points</h1>
          <p className="text-gray-600">Analyze and visualize insights from your transcripts with flexible templates</p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Manage Templates
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Data Point Template Management</DialogTitle>
              </DialogHeader>
              <TemplateManager
                type="datapoint"
                templates={templates.map(template => ({
                  ...template,
                  isActive: template.is_active,
                  isDefault: template.is_default,
                  createdAt: template.created_at,
                  updatedAt: template.updated_at,
                  visualizationType: template.visualization_type,
                  outputSchema: template.output_schema,
                }))}
                onTemplateChange={loadData}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-gray-500" />
              <select
                className="border rounded px-3 py-1 text-sm"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="all">All Templates</option>
                {activeTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <Badge variant="outline">
              {filteredDataPoints.length} analyses
            </Badge>
          </div>

          <div className="grid gap-4">
            {filteredDataPoints.map((dataPoint) => (
              <Card key={dataPoint.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {getVisualizationIcon(templates.find(t => t.id === dataPoint.template_id)?.visualization_type || 'chart')}
                        <Badge variant="outline">
                          {getTemplateName(dataPoint.template_id)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        File {dataPoint.file_id}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(dataPoint.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {renderDataPointVisualization(dataPoint)}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredDataPoints.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No data points found</h3>
                <p className="text-gray-600 mb-4">
                  Analyze your transcripts to generate data points
                </p>
                <Button onClick={() => window.location.href = '/files'}>
                  Upload Files
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <div className="grid gap-4">
            {files.map((file) => (
              <Card key={file.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CardTitle className="text-lg">{file.originalFileName}</CardTitle>
                      <Badge
                        variant="secondary"
                        className={getStatusColor(file.dataPointStatus)}
                      >
                        {file.dataPointStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => handleRunAnalysis(file.id, defaultTemplates.map(t => t.id))}
                        disabled={isProcessing}
                        size="sm"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <BarChart3 className="w-4 h-4 mr-2" />
                        )}
                        Run Analysis
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {file.dataPointTemplatesUsed && file.dataPointTemplatesUsed.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-gray-600">Templates used:</span>
                      {file.dataPointTemplatesUsed.map(templateId => (
                        <Badge key={templateId} variant="outline" className="text-xs">
                          {getTemplateName(templateId)}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {getVisualizationIcon(template.visualization_type)}
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        {template.is_active && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Active
                          </Badge>
                        )}
                        {template.is_default && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            Default
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {template.visualization_type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm">
                        Test
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-gray-600 mb-3">{template.description}</p>
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    <strong>Output Schema:</strong>
                    <pre className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                      {template.output_schema}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
