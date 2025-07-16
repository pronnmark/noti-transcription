'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Settings, Plus, FileText, Filter } from 'lucide-react';
import TemplateManager from '@/components/templates/TemplateManager';

interface ExtractionTemplate {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
  expected_output_format: string;
  created_at: string;
  updated_at: string;
}

interface Extraction {
  id: string;
  file_id: number;
  template_id: string;
  content: string;
  context: string;
  speaker: string;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'archived';
  metadata: any;
  created_at: string;
}

interface AudioFile {
  id: number;
  fileName: string;
  originalFileName: string;
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extractionTemplatesUsed: string[];
  uploadedAt: string;
}

export default function ExtractionsPage() {
  const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  const loadData = async () => {
    try {
      // Load extraction templates
      const templatesResponse = await fetch('/api/extractions/templates');
      const templatesData = await templatesResponse.json();
      setTemplates(templatesData.templates || []);

      // Load files with extraction status
      const filesResponse = await fetch('/api/files');
      const filesData = await filesResponse.json();
      setFiles(filesData.files || []);

      // Load extractions
      const extractionsResponse = await fetch('/api/extractions');
      const extractionsData = await extractionsResponse.json();
      setExtractions(extractionsData.extractions || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeTemplates = templates.filter(t => t.is_active);
  const defaultTemplates = templates.filter(t => t.is_default);

  const filteredExtractions = extractions.filter(extraction => {
    if (selectedTemplate === 'all') return true;
    return extraction.template_id === selectedTemplate;
  });

  const getTemplateName = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    return template?.name || 'Unknown Template';
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRunExtraction = async (fileId: number, templateIds: string[]) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/extractions/run/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateIds: templateIds
        }),
      });
      
      if (response.ok) {
        // Refresh data
        const extractionsResponse = await fetch('/api/extractions');
        const extractionsData = await extractionsResponse.json();
        setExtractions(extractionsData.extractions || []);
      }
    } catch (error) {
      console.error('Error running extraction:', error);
    } finally {
      setIsProcessing(false);
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
          <h1 className="text-2xl font-bold text-gray-900">AI Extractions</h1>
          <p className="text-gray-600">Extract specific elements from your transcripts using flexible templates</p>
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
                <DialogTitle>Extraction Template Management</DialogTitle>
              </DialogHeader>
              <TemplateManager 
                type="extraction" 
                templates={templates.map(template => ({
                  ...template,
                  isActive: template.is_active,
                  isDefault: template.is_default,
                  createdAt: template.created_at,
                  updatedAt: template.updated_at,
                  expectedOutputFormat: template.expected_output_format
                }))} 
                onTemplateChange={loadData}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="extractions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="extractions">Extractions</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="extractions" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
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
              {filteredExtractions.length} items
            </Badge>
          </div>

          <div className="grid gap-4">
            {filteredExtractions.map((extraction) => (
              <Card key={extraction.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">
                        {getTemplateName(extraction.template_id)}
                      </Badge>
                      <Badge 
                        variant="secondary" 
                        className={getPriorityColor(extraction.priority)}
                      >
                        {extraction.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline"
                        className={getStatusColor(extraction.status)}
                      >
                        {extraction.status}
                      </Badge>
                      {extraction.speaker && (
                        <Badge variant="outline">
                          {extraction.speaker}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-gray-900 mb-2">{extraction.content}</p>
                  {extraction.context && (
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Context:</strong> {extraction.context}
                    </p>
                  )}
                  {extraction.timestamp && (
                    <p className="text-xs text-gray-500">
                      Timestamp: {Math.floor(extraction.timestamp / 60)}:{String(Math.floor(extraction.timestamp % 60)).padStart(2, '0')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredExtractions.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No extractions found</h3>
                <p className="text-gray-600 mb-4">
                  Process your transcripts to extract specific elements
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
                        className={getStatusColor(file.extractionStatus)}
                      >
                        {file.extractionStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        onClick={() => handleRunExtraction(file.id, defaultTemplates.map(t => t.id))}
                        disabled={isProcessing}
                        size="sm"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <FileText className="w-4 h-4 mr-2" />
                        )}
                        Run Extraction
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {file.extractionTemplatesUsed && file.extractionTemplatesUsed.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-gray-600">Templates used:</span>
                      {file.extractionTemplatesUsed.map(templateId => (
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
                      <CardTitle className="text-lg">{template.name}</CardTitle>
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
                  <p className="text-gray-600 mb-2">{template.description}</p>
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    <strong>Expected Output:</strong> {template.expected_output_format}
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