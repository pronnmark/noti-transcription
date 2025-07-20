import { db } from "@/lib/db"
import * as schema from "@/lib/database/schema"
import { eq } from 'drizzle-orm';

export interface DynamicPromptConfig {
  summarizationPromptId?: string;
  extractionDefinitionIds: string[];
  useCustomSummarizationPrompt?: string;
}

export interface GeneratedPrompt {
  systemPrompt: string;
  expectedJsonSchema: any;
  extractionMap: Record<string, {
    id: string;
    name: string;
    outputType: 'array' | 'object' | 'value';
    category: 'extraction' | 'datapoint';
  }>;
}

/**
 * Dynamic Prompt Generator - Creates AI prompts based on active extraction definitions
 * 
 * This service generates system prompts that instruct the AI to return structured JSON
 * responses based on user-defined extraction criteria and summarization styles.
 */
export class DynamicPromptGenerator {
  
  /**
   * Generate a complete system prompt based on configuration
   */
  async generatePrompt(config: DynamicPromptConfig): Promise<GeneratedPrompt> {
    const { summarizationPromptId, extractionDefinitionIds, useCustomSummarizationPrompt } = config;
    
    // Get summarization prompt
    let summarizationPrompt = '';
    if (useCustomSummarizationPrompt) {
      summarizationPrompt = useCustomSummarizationPrompt;
    } else if (summarizationPromptId) {
      const summPrompt = await db.query.summarizationPrompts.findFirst({
        where: eq(schema.summarizationPrompts.id, summarizationPromptId),
      });
      summarizationPrompt = summPrompt?.prompt || 'Provide a comprehensive summary of the transcript.';
    } else {
      // Get default summarization prompt
      const defaultPrompt = await db.query.summarizationPrompts.findFirst({
        where: eq(schema.summarizationPrompts.isDefault, true),
      });
      summarizationPrompt = defaultPrompt?.prompt || 'Provide a comprehensive summary of the transcript.';
    }
    
    // Get extraction definitions
    const extractionDefinitions = await db.query.extractionDefinitions.findMany({
      where: (definitions, { inArray }) => inArray(definitions.id, extractionDefinitionIds),
    });
    
    // Build extraction map for result processing
    const extractionMap: Record<string, any> = {};
    const jsonSchema: any = {
      type: 'object',
      properties: {
        summarization: {
          type: 'string',
          description: 'The summarization of the transcript'
        }
      },
      required: ['summarization']
    };
    
    // Build extraction instructions and schema
    const extractionInstructions: string[] = [];
    const extractionDescriptions: string[] = [];
    
    for (const definition of extractionDefinitions) {
      extractionMap[definition.jsonKey] = {
        id: definition.id,
        name: definition.name,
        outputType: definition.outputType,
        category: definition.category,
      };
      
      // Add to JSON schema
      jsonSchema.properties[definition.jsonKey] = JSON.parse(definition.jsonSchema as string);
      jsonSchema.required.push(definition.jsonKey);
      
      // Add to instructions
      extractionInstructions.push(`- ${definition.jsonKey}: ${definition.aiInstructions}`);
      extractionDescriptions.push(`  - **${definition.name}**: ${definition.description}`);
    }
    
    // Build the complete system prompt based on whether we need JSON (for extractions) or can use Markdown
    const hasExtractions = extractionDefinitions.length > 0;
    
    let systemPrompt: string;
    
    if (hasExtractions) {
      // Use JSON format when extractions are needed
      systemPrompt = `You are analyzing a transcript and must return a structured JSON response with the following sections:

## SUMMARIZATION:
${summarizationPrompt}

## EXTRACTIONS:
Extract the following information from the transcript:
${extractionDescriptions.join('\n')}

Instructions:
${extractionInstructions.join('\n')}

## RESPONSE FORMAT:
Return ONLY a valid JSON object with this structure:
{
  "summarization": "Your summary here",
${extractionDefinitions.map(def => `  "${def.jsonKey}": ${this.getExampleForSchema(JSON.parse(def.jsonSchema as string))}`).join(',\n')}
}

CRITICAL FORMATTING REQUIREMENTS:
- Return ONLY raw JSON - NO markdown code blocks, NO backticks, NO triple-backtick-json tags
- Do NOT wrap the JSON in markdown formatting of any kind
- Start your response directly with the opening brace {
- End your response directly with the closing brace }
- All fields are required, use empty arrays/objects if no data found
- Be accurate and specific in your extractions
- Use the exact JSON structure specified above`;
    } else {
      // Use natural Markdown format when only summarization is needed
      systemPrompt = `You are analyzing a transcript and must provide a comprehensive analysis following the template instructions.

## INSTRUCTIONS:
${summarizationPrompt}

## OUTPUT FORMAT:
Follow the template instructions exactly as specified. Use the natural format requested in the template (Markdown, structured text, etc.). Provide a thorough, detailed analysis that covers all aspects requested in the template.`;
    }

    return {
      systemPrompt,
      expectedJsonSchema: jsonSchema,
      extractionMap
    };
  }
  
  /**
   * Generate example JSON for a schema
   */
  private getExampleForSchema(schema: any): string {
    if (schema.type === 'array') {
      return `[/* array of objects matching schema */]`;
    } else if (schema.type === 'object') {
      return `{/* object matching schema */}`;
    } else {
      return `"/* ${schema.type} value */"`;
    }
  }

  /**
   * Extract JSON from markdown-wrapped responses
   */
  private extractJsonFromResponse(response: string): string | null {
    // Remove common markdown code block patterns
    const patterns = [
      // Standard markdown code blocks with json language
      /```json\s*\n?([\s\S]*?)\n?\s*```/g,
      // Code blocks without language specification
      /```\s*\n?([\s\S]*?)\n?\s*```/g,
      // Inline code blocks
      /`([^`]*)`/g,
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match) {
        // Extract the content between code block markers
        let extracted = match[0];
        
        // Remove the markdown markers
        extracted = extracted.replace(/```json\s*\n?/g, '');
        extracted = extracted.replace(/```\s*\n?/g, '');
        extracted = extracted.replace(/\n?\s*```$/g, '');
        extracted = extracted.replace(/^`|`$/g, '');
        extracted = extracted.trim();
        
        // Validate that it looks like JSON (starts with { or [)
        if (extracted.startsWith('{') || extracted.startsWith('[')) {
          console.log('🔍 Extracted JSON from markdown:', extracted.substring(0, 100) + '...');
          return extracted;
        }
      }
    }

    // Fallback: Look for JSON-like content without markdown
    const jsonPattern = /(\{[\s\S]*\})/;
    const match = response.match(jsonPattern);
    if (match) {
      console.log('🔍 Found JSON pattern without markdown:', match[1].substring(0, 100) + '...');
      return match[1].trim();
    }

    return null;
  }

  /**
   * Extract textual summary from AI response when JSON parsing fails
   */
  private extractTextualSummary(response: string): string {
    // Try to extract meaningful content even if JSON parsing failed
    
    // Look for content that might be a summary
    const summaryPatterns = [
      // Look for "summarization": "content" pattern
      /"summarization":\s*"([^"]*?)"/,
      // Look for content after "summary:" or "summarization:"
      /(?:summary|summarization):\s*([^\n\r]*)/i,
      // Look for the first substantial text block
      /([A-Z][^.!?]*[.!?](?:\s+[A-Z][^.!?]*[.!?])*)/,
    ];

    for (const pattern of summaryPatterns) {
      const match = response.match(pattern);
      if (match && match[1] && match[1].length > 20) {
        return match[1].trim();
      }
    }

    // Fallback: Return first 500 characters of response, cleaned up
    const cleaned = response
      .replace(/```[^`]*```/g, '') // Remove code blocks
      .replace(/[{}[\]"]/g, '') // Remove JSON artifacts
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return cleaned.length > 500 ? cleaned.substring(0, 497) + '...' : cleaned;
  }
  
  /**
   * Get active extraction definitions for UI display
   */
  async getActiveExtractionDefinitions(): Promise<schema.ExtractionDefinition[]> {
    return await db.query.extractionDefinitions.findMany({
      where: eq(schema.extractionDefinitions.isActive, true),
      orderBy: (definitions, { asc }) => [asc(definitions.sortOrder), asc(definitions.name)],
    });
  }
  
  /**
   * Get active summarization prompts for UI display
   */
  async getActiveSummarizationPrompts(): Promise<schema.SummarizationPrompt[]> {
    return await db.query.summarizationPrompts.findMany({
      where: eq(schema.summarizationPrompts.isActive, true),
      orderBy: (prompts, { desc, asc }) => [desc(prompts.isDefault), asc(prompts.name)],
    });
  }
  
  /**
   * Parse AI response and store results in database
   */
  async parseAndStoreResults(
    fileId: number,
    aiResponse: string,
    extractionMap: Record<string, any>,
    sessionId: string,
    model: string = 'claude-sonnet-4-20250514',
    templateId?: string | null
  ): Promise<{
    success: boolean;
    extractionResults: schema.ExtractionResult[];
    error?: string;
  }> {
    try {
      // Determine if we expect JSON (extractions) or Markdown (summarization only)
      const hasExtractions = Object.keys(extractionMap).length > 0;
      let parsedResponse;
      
      if (hasExtractions) {
        // Parse JSON response for extractions - with smart extraction and graceful fallback
        try {
          // First, try direct JSON parsing
          parsedResponse = JSON.parse(aiResponse);
          console.log('✅ Direct JSON parsing successful');
        } catch (jsonError) {
          console.warn('🔍 Direct JSON parsing failed, attempting smart extraction:', {
            error: String(jsonError),
            responseLength: aiResponse.length,
            responseStart: aiResponse.substring(0, 100),
          });

          // Try smart JSON extraction from markdown-wrapped responses
          const extractedJson = this.extractJsonFromResponse(aiResponse);
          if (extractedJson) {
            try {
              parsedResponse = JSON.parse(extractedJson);
              console.log('✅ Successfully extracted and parsed JSON from markdown-wrapped response');
            } catch (extractError) {
              console.error('❌ Failed to parse extracted JSON:', {
                error: String(extractError),
                extractedLength: extractedJson.length,
                extractedPreview: extractedJson.substring(0, 100),
              });
              parsedResponse = null;
            }
          } else {
            console.error('❌ No JSON found in AI response:', {
              originalError: String(jsonError),
              responseLength: aiResponse.length,
              responsePreview: aiResponse.substring(0, 200),
            });
            parsedResponse = null;
          }

          // If all parsing attempts failed, create fallback response
          if (!parsedResponse) {
            console.warn('⚠️ Creating fallback response due to complete JSON parsing failure');
            parsedResponse = {
              summarization: aiResponse.length > 0 ? this.extractTextualSummary(aiResponse) : 'Unable to generate summary due to processing error.',
              ...Object.fromEntries(Object.keys(extractionMap).map(key => [key, []]))
            };
          }
        }
      } else {
        // Handle Markdown response for summarization-only requests
        console.log('📝 Processing Markdown response for summarization-only request');
        parsedResponse = {
          summarization: aiResponse.trim() || 'No content received from AI.'
        };
      }
      
      // Store summarization with fallback
      const summaryContent = parsedResponse.summarization || 'Summary not available due to processing error.';
      await db.insert(schema.summarizations).values({
        fileId,
        templateId: templateId || null,
        model,
        prompt: 'Dynamic extraction and summarization prompt',
        content: summaryContent,
      });
      
      // Store extraction results - with graceful handling of empty data
      const extractionResults: schema.ExtractionResult[] = [];
      
      for (const [jsonKey, extractionInfo] of Object.entries(extractionMap)) {
        let extractionData = parsedResponse[jsonKey];
        
        // Provide default empty values if extraction data is missing
        if (!extractionData) {
          extractionData = extractionInfo.outputType === 'array' ? [] : 
                          extractionInfo.outputType === 'object' ? {} : null;
        }
        
        // Only store if we have some data (including empty arrays/objects)
        if (extractionData !== null) {
          const result = {
            fileId,
            definitionId: extractionInfo.id,
            extractionType: jsonKey,
            content: JSON.stringify(extractionData),
            schemaVersion: '1.0',
            model,
          };
          
          // Insert into database
          await db.insert(schema.extractionResults).values(result);
          
          extractionResults.push(result as schema.ExtractionResult);
        }
      }
      
      return {
        success: true,
        extractionResults,
      };
      
    } catch (error) {
      // Enhanced error logging with detailed context
      console.error('🚨 Critical error in parseAndStoreResults:', {
        error: String(error),
        fileId,
        sessionId,
        model,
        responseLength: aiResponse?.length || 0,
        responsePreview: aiResponse?.substring(0, 200) || 'No response',
        extractionMapKeys: Object.keys(extractionMap),
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        extractionResults: [],
        error: `Parsing failed: ${String(error)}. Response length: ${aiResponse?.length || 0}`,
      };
    }
  }
  
  /**
   * Get extraction results for a file
   */
  async getExtractionResults(fileId: number): Promise<{
    [extractionType: string]: any[];
  }> {
    const results = await db.query.extractionResults.findMany({
      where: eq(schema.extractionResults.fileId, fileId),
      with: {
        definition: true,
      },
      orderBy: (results, { asc }) => [asc(results.createdAt)],
    });
    
    const groupedResults: { [extractionType: string]: any[] } = {};
    
    for (const result of results) {
      const extractionType = result.extractionType;
      if (!groupedResults[extractionType]) {
        groupedResults[extractionType] = [];
      }
      
      try {
        const parsedContent = JSON.parse(result.content as string);
        if (Array.isArray(parsedContent)) {
          groupedResults[extractionType].push(...parsedContent);
        } else {
          groupedResults[extractionType].push(parsedContent);
        }
      } catch (error) {
        console.error(`Error parsing extraction result for ${extractionType}:`, error);
      }
    }
    
    return groupedResults;
  }
  
  /**
   * Create a new extraction definition
   */
  async createExtractionDefinition(definition: {
    name: string;
    description: string;
    jsonKey: string;
    jsonSchema: any;
    aiInstructions: string;
    outputType: 'array' | 'object' | 'value';
    category: 'extraction' | 'datapoint';
  }): Promise<schema.ExtractionDefinition> {
    const newDefinition = {
      name: definition.name,
      description: definition.description,
      jsonKey: definition.jsonKey,
      jsonSchema: JSON.stringify(definition.jsonSchema),
      aiInstructions: definition.aiInstructions,
      outputType: definition.outputType,
      category: definition.category,
      isActive: true,
      sortOrder: 0,
    };
    
    await db.insert(schema.extractionDefinitions).values(newDefinition);
    
    return newDefinition as schema.ExtractionDefinition;
  }
  
  /**
   * Update an existing extraction definition
   */
  async updateExtractionDefinition(
    id: string,
    updates: Partial<schema.ExtractionDefinition>
  ): Promise<void> {
    await db.update(schema.extractionDefinitions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.extractionDefinitions.id, id));
  }
  
  /**
   * Delete an extraction definition
   */
  async deleteExtractionDefinition(id: string): Promise<void> {
    await db.delete(schema.extractionDefinitions)
      .where(eq(schema.extractionDefinitions.id, id));
  }
}

// Export singleton instance
export const dynamicPromptGenerator = new DynamicPromptGenerator();