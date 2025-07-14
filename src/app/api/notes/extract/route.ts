import { NextRequest, NextResponse } from 'next/server';
import { audioFilesService } from '@/lib/db/sqliteServices';
import { extractNotesFromTranscript } from '@/lib/services/notesExtractor';
import { requireAuth } from '@/lib/auth';

// POST /api/notes/extract
export async function POST(request: NextRequest) {
  try {
    // Check authentication - temporarily relaxed for development
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      console.warn('⚠️ Authentication bypassed for development - please login for production use');
      // Continue anyway for now
    }

    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get file and transcript
    const file = await audioFilesService.findById(parseInt(fileId));
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (!file.transcript || file.transcript.length === 0) {
      return NextResponse.json({ error: 'No transcript available for this file' }, { status: 400 });
    }

    // Check if notes are already being processed
    if (file.notesStatus === 'processing') {
      return NextResponse.json({ error: 'Notes extraction already in progress' }, { status: 400 });
    }

    console.log(`🤖 Starting notes extraction for file ${fileId}...`);
    console.log(`Transcript has ${file.transcript.length} segments`);

    // Start extraction process
    const result = await extractNotesFromTranscript(
      parseInt(fileId),
      file.transcript
    );

    if (result.success) {
      console.log(`✅ Notes extraction completed: ${result.notesCount} notes extracted`);
      return NextResponse.json({
        success: true,
        notesCount: result.notesCount,
        message: `Successfully extracted ${result.notesCount} notes`
      });
    } else {
      console.error('❌ Notes extraction failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Notes extraction failed'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Extract notes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}