import { NextRequest, NextResponse } from 'next/server';
import { psychologyService } from '@/lib/services/psychologyService';
import { audioFilesService } from '@/lib/db/sqliteServices';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const limit = url.searchParams.get('limit');

    if (fileId) {
      // Get evaluations for specific file
      const evaluations = await psychologyService.getEvaluationsByFileId(parseInt(fileId));
      return NextResponse.json({ 
        success: true, 
        evaluations,
        count: evaluations.length 
      });
    } else if (startDate && endDate) {
      // Get evaluations for date range
      const evaluations = await psychologyService.getEvaluationsByDateRange(startDate, endDate);
      return NextResponse.json({ 
        success: true, 
        evaluations,
        count: evaluations.length 
      });
    } else {
      // Get recent evaluations
      const limitNum = limit ? parseInt(limit) : 10;
      const evaluations = await psychologyService.getRecentEvaluations(limitNum);
      return NextResponse.json({ 
        success: true, 
        evaluations,
        count: evaluations.length 
      });
    }
  } catch (error) {
    console.error('Error fetching psychological evaluations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch psychological evaluations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Get the audio file and transcript
    const audioFile = await audioFilesService.findById(parseInt(fileId));
    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      );
    }

    if (!audioFile.transcript) {
      return NextResponse.json(
        { error: 'No transcript available for this file' },
        { status: 400 }
      );
    }

    // Run psychological evaluation
    const result = await psychologyService.evaluateTranscript(
      parseInt(fileId),
      audioFile.transcript
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        evaluation: result.evaluation,
        message: 'Psychological evaluation completed successfully'
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Psychological evaluation failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating psychological evaluation:', error);
    return NextResponse.json(
      { error: 'Failed to create psychological evaluation' },
      { status: 500 }
    );
  }
}