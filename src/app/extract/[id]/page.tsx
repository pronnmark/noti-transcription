'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, FileText, Brain } from 'lucide-react';
import Link from 'next/link';

interface AudioFile {
  id: string;
  originalName: string;
  aiExtract?: string;
  aiExtractStatus?: string;
  aiExtractedAt?: string;
}

export default function ExtractPage() {
  const params = useParams();
  const [file, setFile] = useState<AudioFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      loadFileAndExtract();
    }
  }, [params.id]);

  async function loadFileAndExtract() {
    try {
      setIsLoading(true);
      setError(null);

      // Get file info
      const fileResponse = await fetch(`/api/files/${params.id}`);
      if (!fileResponse.ok) {
        throw new Error('Failed to load file');
      }
      const fileData = await fileResponse.json();

      // Get extract info
      const extractResponse = await fetch(`/api/extract?fileId=${params.id}`);
      if (!extractResponse.ok) {
        throw new Error('Failed to load extract');
      }
      const extractData = await extractResponse.json();

      setFile({
        ...fileData,
        aiExtract: extractData.content,
        aiExtractStatus: extractData.status,
        aiExtractedAt: extractData.extractedAt
      });

    } catch (error) {
      console.error('Error loading extract:', error);
      setError(error instanceof Error ? error.message : 'Failed to load extract');
    } finally {
      setIsLoading(false);
    }
  }

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
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-muted-foreground mb-4">{error || 'Extract not found'}</p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
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
              {file.aiExtractStatus === 'completed' && file.aiExtractedAt && (
                <>Generated on {formatDate(file.aiExtractedAt)}</>
              )}
              {file.aiExtractStatus === 'processing' && (
                <>Currently processing...</>
              )}
              {file.aiExtractStatus === 'failed' && (
                <>Extraction failed - please try again</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {file.aiExtract ? (
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {file.aiExtract}
                </div>
              </div>
            ) : file.aiExtractStatus === 'processing' ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Processing AI extraction...</span>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No AI extract available for this file.
                </p>
                <Link href={`/transcript/${file.id}`}>
                  <Button variant="outline">
                    View Transcript Instead
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Link href={`/transcript/${file.id}`}>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              View Full Transcript
            </Button>
          </Link>
          <Button 
            variant="outline"
            onClick={() => {
              if (file.aiExtract) {
                navigator.clipboard.writeText(file.aiExtract);
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