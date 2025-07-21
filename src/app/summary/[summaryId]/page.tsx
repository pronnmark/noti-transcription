'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Copy, RefreshCw, FileText, Calendar, User, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SummaryData {
  id: string;
  content: string;
  model: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  file: {
    id: number;
    fileName: string;
    originalFileName: string;
  };
  template: {
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
  } | null;
}

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const summaryId = params.summaryId as string;

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Scrolling test laboratory refs and state
  const container1Ref = useRef<HTMLDivElement>(null);
  const container2Ref = useRef<HTMLDivElement>(null);
  const container3Ref = useRef<HTMLDivElement>(null);
  const container4Ref = useRef<HTMLDivElement>(null);
  
  const [debugInfo, setDebugInfo] = useState<{[key: string]: any}>({});
  const [scrollEvents, setScrollEvents] = useState<string[]>([]);

  // Debugging functions
  const measureContainer = (ref: React.RefObject<HTMLDivElement>, name: string) => {
    if (ref.current) {
      const elem = ref.current;
      return {
        clientHeight: elem.clientHeight,
        scrollHeight: elem.scrollHeight,
        offsetHeight: elem.offsetHeight,
        scrollTop: elem.scrollTop,
        canScroll: elem.scrollHeight > elem.clientHeight,
        hasScrollbar: elem.scrollHeight > elem.clientHeight && elem.offsetHeight > 0
      };
    }
    return null;
  };

  const logScrollEvent = (event: string, container: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setScrollEvents(prev => [...prev.slice(-9), `${timestamp}: ${event} on ${container}`]);
  };

  const testProgrammaticScroll = (ref: React.RefObject<HTMLDivElement>, name: string, amount: number) => {
    if (ref.current) {
      const oldScrollTop = ref.current.scrollTop;
      ref.current.scrollTop += amount;
      const newScrollTop = ref.current.scrollTop;
      logScrollEvent(`Programmatic scroll ${oldScrollTop}→${newScrollTop}`, name);
      updateDebugInfo();
    }
  };

  const updateDebugInfo = () => {
    setDebugInfo({
      container1: measureContainer(container1Ref, 'Container1'),
      container2: measureContainer(container2Ref, 'Container2'), 
      container3: measureContainer(container3Ref, 'Container3'),
      container4: measureContainer(container4Ref, 'Container4'),
    });
  };

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`/api/summary/${summaryId}`);
        if (response.ok) {
          const data = await response.json();
          setSummary(data.summary);
        } else {
          console.error('Failed to fetch summary');
          toast.error('Failed to load summary');
        }
      } catch (error) {
        console.error('Error fetching summary:', error);
        toast.error('Error loading summary');
      } finally {
        setIsLoading(false);
      }
    };

    if (summaryId) {
      fetchSummary();
    }
  }, [summaryId]);

  // Scrolling test laboratory setup
  useEffect(() => {
    if (summary) {
      // Wait for DOM to be ready, then setup debugging
      setTimeout(() => {
        updateDebugInfo();
        
        // Add event listeners to all containers
        const containers = [
          { ref: container1Ref, name: 'Container1' },
          { ref: container2Ref, name: 'Container2' },
          { ref: container3Ref, name: 'Container3' },
          { ref: container4Ref, name: 'Container4' }
        ];

        containers.forEach(({ ref, name }) => {
          if (ref.current) {
            const element = ref.current;
            
            const onScroll = () => logScrollEvent('scroll', name);
            const onWheel = () => logScrollEvent('wheel', name);
            const onTouchStart = () => logScrollEvent('touchstart', name);
            const onTouchMove = () => logScrollEvent('touchmove', name);
            
            element.addEventListener('scroll', onScroll);
            element.addEventListener('wheel', onWheel);
            element.addEventListener('touchstart', onTouchStart);
            element.addEventListener('touchmove', onTouchMove);

            // Cleanup function stored for later
            (element as any)._cleanup = () => {
              element.removeEventListener('scroll', onScroll);
              element.removeEventListener('wheel', onWheel);
              element.removeEventListener('touchstart', onTouchStart);
              element.removeEventListener('touchmove', onTouchMove);
            };
          }
        });

        // Update measurements every 2 seconds
        const interval = setInterval(updateDebugInfo, 2000);
        
        return () => {
          clearInterval(interval);
          containers.forEach(({ ref }) => {
            if (ref.current && (ref.current as any)._cleanup) {
              (ref.current as any)._cleanup();
            }
          });
        };
      }, 100);
    }
  }, [summary]);

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary.content);
      toast.success('Summary copied to clipboard');
    }
  };

  const handleRegenerate = async () => {
    if (!summary) return;
    
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/ai/dynamic-process/${summary.file.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summarizationPromptId: summary.template?.id || null,
        }),
      });
      
      if (response.ok) {
        toast.success('New summary generated');
        // Navigate back to the summarization list to see the new summary
        router.push('/ai/summarization');
      } else {
        toast.error('Failed to generate new summary');
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
      toast.error('Error generating new summary');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!summary) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this summary? This action cannot be undone.');
    
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/summary/${summaryId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success('Summary deleted successfully');
        // Navigate back to the summarization list
        router.push('/ai/summarization');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete summary');
      }
    } catch (error) {
      console.error('Error deleting summary:', error);
      toast.error('Failed to delete summary');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Summary Not Found</h3>
            <p className="text-gray-600 mb-4">
              The summary you're looking for doesn't exist or has been deleted.
            </p>
            <Button onClick={() => router.push('/ai/summarization')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Summaries
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/ai/summarization')}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">AI Summary</h1>
                <p className="text-sm text-gray-600">{summary.file.originalFileName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-3"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isRegenerating || isDeleting}
                className="h-8 px-3"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Regenerate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting || isRegenerating}
                className="h-8 px-3 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
              >
                {isDeleting ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-3 h-3 mr-1" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-4 py-6 flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default" className="text-xs">
                    Latest
                  </Badge>
                  {summary.template && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                      {summary.template.name}
                      {summary.template.isDefault && " (Default)"}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {summary.model}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span className="hidden sm:inline">{formatDate(summary.createdAt)}</span>
                    <span className="sm:hidden">{new Date(summary.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              {summary.template?.description && (
                <div className="text-sm text-gray-600">
                  <strong>Template:</strong> {summary.template.description}
                </div>
              )}
            </CardHeader>
            
            <CardContent className="p-6">
              {/* SUCCESS: Using the proven working approach from Test 1 */}
              <div 
                className="overflow-y-auto border rounded-lg p-4 bg-white"
                style={{ height: '60vh' }}
              >
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed break-words">
                  {summary.content}
                </div>
              </div>
              
              {/* Actions */}
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push('/ai/summarization')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to All Summaries
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}