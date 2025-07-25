import { getAvailableModels } from '@/lib/services/customAI';
import { createDebugLogger, createSuccessResponse, withErrorHandler } from '@/lib/api-utils';

const _debugLog = createDebugLogger('ai-models');

export const GET = withErrorHandler(async () => {
  const modelDetails = getAvailableModels();
  const models = modelDetails.map((model: { id: string }) => model.id);

  return createSuccessResponse({
    models,
    modelDetails,
    configured: models.length > 0,
    message: models.length === 0 ? 'No AI models configured. Please configure custom AI endpoint in Settings or set environment variables.' : undefined,
  });
});
