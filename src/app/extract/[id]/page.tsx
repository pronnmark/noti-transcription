'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, FileText, Brain } from 'lucide-react';
import Link from 'next/link';

interface AudioFile {
  id: string;
  originalName: string;
}

interface Extract {
  id: string;
  fileId: string;
  content: string;
  model: string;
  prompt: string;
  createdAt: string;
  status: string;
}

export default function ExtractPage() {
  const params = useParams();
  const [file, setFile] = useState<AudioFile | null>(null);
  const [extract, setExtract] = useState<Extract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFileAndExtract = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get individual extract by ID
      const extractResponse = await fetch(`/api/extract/${params.id}`);
      if (!extractResponse.ok) {
        throw new Error('Failed to load extract');
      }
      const extractData = await extractResponse.json();
      setExtract(extractData);

      // Get file info using fileId from extract
      const fileResponse = await fetch(`/api/files/${extractData.fileId}`);
      if (!fileResponse.ok) {
        throw new Error('Failed to load file');
      }
      const fileData = await fileResponse.json();
      setFile({
        id: fileData.id,
        originalName:
          fileData.originalFileName || fileData.originalName || 'Unknown File',
      });
    } catch (error) {
      console.error('Error loading extract:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to load extract',
      );
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      loadFileAndExtract();
    }
  }, [params.id, loadFileAndExtract]);

  function formatDate(dateString?: string) {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !file || !extract) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Error</h1>
          <p className="mb-4 text-muted-foreground">
            {error || 'Extract not found'}
          </p>
          <Link href="/ai/extracts">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Extracts
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/ai/extracts">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Extracts
          </Button>
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Brain className="h-6 w-6" />
            AI Extract
          </h1>
          <p className="text-muted-foreground">{file.originalName}</p>
        </div>
      </div>

      {/* Extract Content */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              AI-Generated Summary
            </CardTitle>
            <CardDescription>
              Generated on {formatDate(extract.createdAt)} using {extract.model}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {extract.status === 'completed' && extract.content ? (
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {extract.content}
                </div>
              </div>
            ) : extract.status === 'processing' ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                <span>Processing AI extraction...</span>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="mb-4 text-muted-foreground">
                  Extract failed or has no content.
                </p>
                <Link href={`/transcript/${extract.fileId}`}>
                  <Button variant="outline">View Transcript Instead</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prompt Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Prompt Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              {extract.prompt}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Link href={`/transcript/${extract.fileId}`}>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              View Full Transcript
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              if (extract.content) {
                navigator.clipboard.writeText(extract.content);
                // You could add a toast here
              }
            }}
          >
            Copy Extract
          </Button>
        </div>
      </div>
    </div>
  );
}
