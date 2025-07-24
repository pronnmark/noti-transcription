import { NextResponse } from 'next/server';
import { getAvailableModels } from '@/lib/services/customAI';

// Debug logging (can be disabled by setting DEBUG_API=false)
const DEBUG_API = process.env.DEBUG_API !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_API) {
    console.log(...args);
  }
};

export async function GET() {
  try {
    const modelDetails = getAvailableModels();
    const models = modelDetails.map((model: any) => model.id);

    return NextResponse.json({
      models,
      modelDetails,
      configured: models.length > 0,
      message: models.length === 0 ? 'No AI models configured. Please configure custom AI endpoint in Settings or set environment variables.' : undefined,
    });
  } catch (error) {
    debugLog('Error fetching available models:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
