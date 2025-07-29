'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  FileText,
  Calendar,
  User,
  Loader2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { TelegramShareButton } from '@/components/ui/telegram-share-button';

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

  const [debugInfo, setDebugInfo] = useState<{ [key: string]: any }>({});
  const [scrollEvents, setScrollEvents] = useState<string[]>([]);

  // Debugging functions
  const measureContainer = (
    ref: React.RefObject<HTMLDivElement | null>,
    name: string,
  ) => {
    if (ref.current) {
      const elem = ref.current;
      return {
        clientHeight: elem.clientHeight,
        scrollHeight: elem.scrollHeight,
        offsetHeight: elem.offsetHeight,
        scrollTop: elem.scrollTop,
        canScroll: elem.scrollHeight > elem.clientHeight,
        hasScrollbar:
          elem.scrollHeight > elem.clientHeight && elem.offsetHeight > 0,
      };
    }
    return null;
  };

  const logScrollEvent = (event: string, container: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setScrollEvents(prev => [
      ...prev.slice(-9),
      `${timestamp}: ${event} on ${container}`,
    ]);
  };

  const testProgrammaticScroll = (
    ref: React.RefObject<HTMLDivElement>,
    name: string,
    amount: number,
  ) => {
    if (ref.current) {
      const oldScrollTop = ref.current.scrollTop;
      ref.current.scrollTop += amount;
      const newScrollTop = ref.current.scrollTop;
      logScrollEvent(
        `Programmatic scroll ${oldScrollTop}→${newScrollTop}`,
        name,
      );
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
          { ref: container4Ref, name: 'Container4' },
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
      const response = await fetch(
        `/api/ai/dynamic-process/${summary.file.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summarizationPromptId: summary.template?.id || null,
          }),
        },
      );

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

    const confirmed = window.confirm(
      'Are you sure you want to delete this summary? This action cannot be undone.',
    );

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
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              Summary Not Found
            </h3>
            <p className="mb-4 text-gray-600">
              The summary you're looking for doesn't exist or has been deleted.
            </p>
            <Button onClick={() => router.push('/ai/summarization')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Summaries
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/ai/summarization')}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  AI Summary
                </h1>
                <p className="text-sm text-gray-600">
                  {summary.file.originalFileName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-3"
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </Button>
              <TelegramShareButton
                fileId={summary.file.id}
                fileName={summary.file.originalFileName}
                content={summary.content}
                summarizationId={summary.id}
                size="sm"
                variant="outline"
                className="h-8 px-3"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isRegenerating || isDeleting}
                className="h-8 px-3"
              >
                {isRegenerating ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Regenerate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting || isRegenerating}
                className="h-8 px-3 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                {isDeleting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-3 w-3" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        <div className="mx-auto flex min-h-0 max-w-4xl flex-1 flex-col px-4 py-6">
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    Latest
                  </Badge>
                  {summary.template && (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-xs text-green-700"
                    >
                      {summary.template.name}
                      {summary.template.isDefault && ' (Default)'}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {summary.model}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className="hidden sm:inline">
                      {formatDate(summary.createdAt)}
                    </span>
                    <span className="sm:hidden">
                      {new Date(summary.createdAt).toLocaleDateString()}
                    </span>
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
                className="overflow-y-auto rounded-lg border bg-white p-4"
                style={{ height: '60vh' }}
              >
                <div className="whitespace-pre-wrap break-words leading-relaxed text-gray-800">
                  {summary.content}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push('/ai/summarization')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
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
