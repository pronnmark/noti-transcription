import { NextResponse } from 'next/server';
import { getAvailableModels } from '@/lib/services/openrouter';

export async function GET() {
  try {
    const models = getAvailableModels();
    
    return NextResponse.json({
      models,
      recommended: {
        summarization: 'anthropic/claude-sonnet-4',
        extraction: 'anthropic/claude-sonnet-4', 
        dataPoints: 'anthropic/claude-3-haiku', // Faster for structured analysis
        longTranscripts: 'google/gemini-pro-1.5' // Huge context window
      }
    });
  } catch (error) {
    console.error('Error fetching available models:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}