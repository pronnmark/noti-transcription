import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { realTimeSessions, realTimeThoughts } from '@/lib/database/schema/system';
import { systemSettings } from '@/lib/database/schema/users';
import { eq } from 'drizzle-orm';
import { customAIService } from '@/lib/services/customAI';
import { getTranscript } from '@/lib/transcription';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const chunkNumber = parseInt(formData.get('chunkNumber') as string);
    const chunkStartTime = formData.get('chunkStartTime') as string;
    const chunkEndTime = formData.get('chunkEndTime') as string;
    const audioChunk = formData.get('audioChunk') as File;

    if (!sessionId || chunkNumber === undefined || !audioChunk) {
      return NextResponse.json(
        { error: 'sessionId, chunkNumber, and audioChunk are required' },
        { status: 400 }
      );
    }

    // Get the session details
    const session = await db
      .select()
      .from(realTimeSessions)
      .where(eq(realTimeSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session[0].status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    // Get AI settings for processing
    const settings = await db
      .select()
      .from(systemSettings)
      .limit(1);

    if (settings.length === 0 || !settings[0].customAiBaseUrl || !settings[0].customAiApiKey) {
      return NextResponse.json(
        { error: 'AI configuration not found. Please configure AI settings first.' },
        { status: 400 }
      );
    }

    const aiSettings = settings[0];

    // Create a temporary file for the audio chunk
    const tempFileName = `temp_chunk_${sessionId}_${chunkNumber}_${Date.now()}.webm`;
    const tempFilePath = `/tmp/${tempFileName}`;
    
    // Write the audio chunk to a temporary file
    const arrayBuffer = await audioChunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Use Node.js fs to write the file
    const fs = require('fs');
    fs.writeFileSync(tempFilePath, buffer);

    try {
      // Transcribe the audio chunk using Whisper
      // For now, use a simplified approach - in production this would use the full transcription pipeline
      const transcript = `[Transcription of chunk ${chunkNumber}]`; // Placeholder
      
      // Use the real transcription function when ready
      // const transcriptResult = await getTranscript(tempFilePath, {
      //   language: 'auto',
      //   enableSpeakerDiarization: false,
      //   modelSize: 'base'
      // });

      // Generate AI thought using the custom AI service
      const aiPrompt = `${session[0].aiInstruction}

Transcript of audio chunk ${chunkNumber} (${chunkStartTime} - ${chunkEndTime}):
${transcript}

Please provide your analysis based on the instruction above:`;

      const thought = await customAIService.extractFromTranscript(
        transcript,
        aiPrompt,
        aiSettings.customAiModel || 'gpt-3.5-turbo'
      );

      if (!thought) {
        throw new Error('AI service returned empty response');
      }
      const processingTime = Date.now() - startTime;

      // Save the thought to database
      const savedThought = await db
        .insert(realTimeThoughts)
        .values({
          sessionId,
          chunkNumber,
          chunkStartTime: chunkStartTime ? parseInt(chunkStartTime) : 0,
          chunkEndTime: chunkEndTime ? parseInt(chunkEndTime) : 0,
          transcriptText: transcript,
          aiThought: thought,
          processingTimeMs: processingTime,
          status: 'completed',
        })
        .returning();

      // Update session chunk count
      await db
        .update(realTimeSessions)
        .set({ totalChunks: chunkNumber + 1 })
        .where(eq(realTimeSessions.id, sessionId));

      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temp file:', cleanupError);
      }

      return NextResponse.json({
        success: true,
        thought: savedThought[0],
        processingTimeMs: processingTime,
      });

    } catch (processingError) {
      // Clean up temp file on error
      try {
        const fs = require('fs');
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temp file on error:', cleanupError);
      }
      
      throw processingError;
    }

  } catch (error) {
    console.error('Error processing real-time chunk:', error);
    
    const processingTime = Date.now() - startTime;
    
    // Try to save error information to database if we have session info
    try {
      const formData = await request.formData();
      const sessionId = formData.get('sessionId') as string;
      const chunkNumber = parseInt(formData.get('chunkNumber') as string);
      
      if (sessionId && chunkNumber !== undefined) {
        await db
          .insert(realTimeThoughts)
          .values({
            sessionId,
            chunkNumber,
            chunkStartTime: 0,
            chunkEndTime: 0,
            transcriptText: '',
            aiThought: `Error processing chunk: ${error instanceof Error ? error.message : 'Unknown error'}`,
            processingTimeMs: processingTime,
            status: 'failed',
          });
      }
    } catch (dbError) {
      console.error('Failed to save error to database:', dbError);
    }

    return NextResponse.json(
      { 
        error: 'Failed to process chunk',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: processingTime
      },
      { status: 500 }
    );
  }
}