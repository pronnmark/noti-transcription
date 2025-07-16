'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface AudioFile {
  id: number;
  fileName: string;
  originalFileName: string;
  uploadedAt: string;
  duration?: number;
  summarizationStatus: 'pending' | 'processing' | 'completed' | 'failed';
  summarizationContent?: string;
  transcript?: any;
}

interface SummarizationTemplate {
  id: string;
  title: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

export default function SummarizationPage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [templates, setTemplates] = useState<SummarizationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<AudioFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load files with summarization data
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const response = await fetch('/api/files');
        const data = await response.json();
        setFiles(data.files || []);
      } catch (error) {
        console.error('Error loading files:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/extract/templates');
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    };

    loadFiles();
    loadTemplates();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
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

  const handleGenerateSummary = async (fileId: number) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/summarization/${fileId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Refresh files to show updated status
        const filesResponse = await fetch('/api/files');
        const data = await filesResponse.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error generating summary:', error);
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
          <h1 className="text-2xl font-bold text-gray-900">AI Summarization</h1>
          <p className="text-gray-600">Generate intelligent summaries of your transcripts</p>
        </div>
        <Button variant="outline" size="sm">
          <FileText className="w-4 h-4 mr-2" />
          Manage Templates
        </Button>
      </div>

      <div className="grid gap-4">
        {files.map((file) => (
          <Card key={file.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(file.summarizationStatus)}
                    <CardTitle className="text-lg">{file.originalFileName}</CardTitle>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={getStatusColor(file.summarizationStatus)}
                  >
                    {file.summarizationStatus}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  {file.summarizationStatus === 'pending' && (
                    <Button 
                      onClick={() => handleGenerateSummary(file.id)}
                      disabled={isProcessing}
                      size="sm"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      Generate Summary
                    </Button>
                  )}
                  {file.summarizationStatus === 'completed' && (
                    <Button 
                      onClick={() => setSelectedFile(file)}
                      variant="outline"
                      size="sm"
                    >
                      View Summary
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {file.summarizationStatus === 'completed' && file.summarizationContent && (
              <CardContent className="pt-0">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Summary:</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {file.summarizationContent}
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {files.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
            <p className="text-gray-600 mb-4">
              Upload audio files to start generating summaries
            </p>
            <Button onClick={() => window.location.href = '/files'}>
              Upload Files
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}