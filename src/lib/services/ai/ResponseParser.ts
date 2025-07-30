/**
 * ResponseParser - Single Responsibility: Parse AI service responses
 * Extracted from CustomAIService to follow SRP
 */
export class ResponseParser {
  /**
   * Parse JSON response from AI service with fallback handling
   */
  static parseJSONResponse(response: string): any {
    try {
      // Try to extract JSON from response (handle cases where AI adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Try parsing the entire response as JSON
      return JSON.parse(response);
    } catch (error) {
      console.warn('Failed to parse JSON response, returning raw text');
      return { content: response, parseError: true };
    }
  }

  /**
   * Clean and extract JSON from AI response text
   */
  static extractJSON(text: string): any {
    try {
      // Remove markdown code blocks
      const cleanResponse = text
        .trim()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '');

      // Find JSON object in the text
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(
        `Failed to parse AI response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate parsed response structure
   */
  static validateResponseStructure(data: any, requiredFields: string[] = []): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Response data must be an object');
    }

    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Response missing required field: ${field}`);
      }
    }
  }

  /**
   * Parse OpenAI-compatible API response
   */
  static parseOpenAIResponse(data: any): string {
    this.validateResponseStructure(data, ['choices']);

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No choices in AI response');
    }

    const choice = data.choices[0];
    if (!choice?.message?.content) {
      throw new Error('Invalid response structure from AI API');
    }

    return choice.message.content;
  }

  /**
   * Parse streaming response chunk
   */
  static parseStreamingChunk(chunk: string): { content?: string; done: boolean } {
    try {
      // Handle different streaming formats
      if (chunk.startsWith('data: ')) {
        const jsonStr = chunk.slice(6).trim();
        
        if (jsonStr === '[DONE]') {
          return { done: true };
        }

        const data = JSON.parse(jsonStr);
        const content = data.choices?.[0]?.delta?.content || '';
        
        return { content, done: false };
      }

      // Handle raw JSON chunks
      const data = JSON.parse(chunk);
      const content = data.content || data.text || '';
      
      return { content, done: data.done || false };
    } catch (error) {
      console.warn('Failed to parse streaming chunk:', chunk);
      return { done: false };
    }
  }

  /**
   * Extract usage statistics from response
   */
  static extractUsageStats(data: any): { 
    promptTokens?: number; 
    completionTokens?: number; 
    totalTokens?: number 
  } {
    if (!data.usage) {
      return {};
    }

    return {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    };
  }

  /**
   * Sanitize response content (remove potential sensitive information)
   */
  static sanitizeResponse(content: string): string {
    // Remove potential API keys, tokens, or other sensitive data
    const sensitivePatterns = [
      /api[_-]?key[=:\s]+[^\s\n]*/gi,
      /token[=:\s]+[^\s\n]*/gi,
      /secret[=:\s]+[^\s\n]*/gi,
      /password[=:\s]+[^\s\n]*/gi,
    ];

    let sanitized = content;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }
}