// Temporarily disabled for Supabase migration
// This file needs to be fully converted to use Supabase instead of Drizzle ORM

export interface DynamicPromptConfig {
  summarizationPromptId?: string;
  extractionDefinitionIds: string[];
  useCustomSummarizationPrompt?: string;
}

export interface GeneratedPrompt {
  systemPrompt: string;
  expectedJsonSchema: any;
  extractionMap: Record<string, unknown>;
}

export interface ParseAndStoreResult {
  success: boolean;
  extractionResults: any[];
  error?: string;
}

export class DynamicPromptGenerator {
  // Stub implementations to allow build to pass
  // These need proper Supabase implementations

  async generatePrompt(config: DynamicPromptConfig): Promise<GeneratedPrompt> {
    return {
      systemPrompt: "Default system prompt - needs implementation",
      expectedJsonSchema: {},
      extractionMap: {}
    };
  }

  async parseAndStoreResults(
    fileId: number,
    aiResponse: string,
    extractionMap: Record<string, unknown>,
    sessionId: string,
    model: string,
    summarizationPromptId?: string
  ): Promise<ParseAndStoreResult> {
    return {
      success: false,
      extractionResults: [],
      error: "Not implemented - needs Supabase conversion"
    };
  }

  async getActiveExtractionDefinitions(): Promise<any[]> {
    return [];
  }

  async getActiveSummarizationPrompts(): Promise<any[]> {
    return [];
  }

  async getExtractionResults(fileId: number): Promise<any[]> {
    return [];
  }

  async createExtractionDefinition(definition: any): Promise<any> {
    throw new Error("Not implemented - needs Supabase conversion");
  }

  async updateExtractionDefinition(id: string, updates: any): Promise<void> {
    throw new Error("Not implemented - needs Supabase conversion");
  }

  async deleteExtractionDefinition(id: string): Promise<void> {
    throw new Error("Not implemented - needs Supabase conversion");
  }
}

// Export singleton instance
export const dynamicPromptGenerator = new DynamicPromptGenerator();