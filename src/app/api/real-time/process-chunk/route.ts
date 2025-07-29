import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/client';
import { customAIService } from '@/lib/services/customAI';
import { getTranscript } from '@/lib/services/transcription';

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
        { status: 400 },
      );
    }

    // Get the session details
    const supabase = getSupabase();
    const { data: sessions, error: sessionError } = await supabase
      .from('real_time_sessions')
      .select('*')
      .eq('id', sessionId)
      .limit(1);

    if (sessionError || !sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = sessions[0];
    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 },
      );
    }

    // Get AI settings for processing
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1);

    if (
      settingsError ||
      !settings ||
      settings.length === 0 ||
      !settings[0].custom_ai_base_url ||
      !settings[0].custom_ai_api_key
    ) {
      return NextResponse.json(
        {
          error:
            'AI configuration not found. Please configure AI settings first.',
        },
        { status: 400 },
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
      const aiPrompt = `${session.ai_instruction}

Transcript of audio chunk ${chunkNumber} (${chunkStartTime} - ${chunkEndTime}):
${transcript}

Please provide your analysis based on the instruction above:`;

      const thought = await customAIService.extractFromTranscript(
        transcript,
        aiPrompt,
        aiSettings.custom_ai_model || 'gpt-3.5-turbo',
      );

      if (!thought) {
        throw new Error('AI service returned empty response');
      }
      const processingTime = Date.now() - startTime;

      // Save the thought to database
      const { data: savedThought, error: thoughtError } = await supabase
        .from('real_time_thoughts')
        .insert({
          session_id: sessionId,
          chunk_number: chunkNumber,
          chunk_start_time: chunkStartTime ? parseInt(chunkStartTime) : 0,
          chunk_end_time: chunkEndTime ? parseInt(chunkEndTime) : 0,
          transcript_text: transcript,
          ai_thought: thought,
          processing_time_ms: processingTime,
          status: 'completed',
        })
        .select()
        .single();

      if (thoughtError) {
        throw new Error(`Failed to save thought: ${thoughtError.message}`);
      }

      // Update session chunk count
      const { error: updateError } = await supabase
        .from('real_time_sessions')
        .update({ total_chunks: chunkNumber + 1 })
        .eq('id', sessionId);

      if (updateError) {
        console.warn('Failed to update session chunk count:', updateError);
      }

      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temp file:', cleanupError);
      }

      return NextResponse.json({
        success: true,
        thought: savedThought,
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
        const supabase = getSupabase();
        await supabase.from('real_time_thoughts').insert({
          session_id: sessionId,
          chunk_number: chunkNumber,
          chunk_start_time: 0,
          chunk_end_time: 0,
          transcript_text: '',
          ai_thought: `Error processing chunk: ${error instanceof Error ? error.message : 'Unknown error'}`,
          processing_time_ms: processingTime,
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
        processingTimeMs: processingTime,
      },
      { status: 500 },
    );
  }
}
