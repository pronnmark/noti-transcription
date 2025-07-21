import { NextResponse } from 'next/server';
import { getAvailableModels } from '@/lib/services/customAI';

export async function GET() {
  try {
    const modelDetails = getAvailableModels();
    const models = modelDetails.map(model => model.id);
    
    return NextResponse.json({
      models,
      modelDetails,
      configured: models.length > 0,
      message: models.length === 0 ? 'No AI models configured. Please configure custom AI endpoint in Settings or set environment variables.' : undefined
    });
  } catch (error) {
    console.error('Error fetching available models:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}