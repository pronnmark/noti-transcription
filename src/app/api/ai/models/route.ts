import { getAvailableModels } from '@/lib/services/customAI';
import { NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';

export const GET = withAuthMiddleware(async () => {
  const modelDetails = getAvailableModels();
  const models = modelDetails.map((model: { id: string }) => model.id);

  return NextResponse.json({
    models,
    modelDetails,
    configured: models.length > 0,
    message: models.length === 0 ? 'No AI models configured. Please configure custom AI endpoint in Settings or set environment variables.' : undefined,
  });
});
