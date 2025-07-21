import { BaseService } from '../core/BaseService';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'extraction' | 'summarization' | 'analysis' | 'general';
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVariables {
  [key: string]: string | number | boolean;
}

export class PromptEngine extends BaseService {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    super('PromptEngine');
  }

  protected async onInitialize(): Promise<void> {
    // Load default templates
    this.loadDefaultTemplates();
    this._logger.info('Prompt engine initialized with default templates');
  }

  protected async onDestroy(): Promise<void> {
    this.templates.clear();
    this._logger.info('Prompt engine destroyed');
  }

  private loadDefaultTemplates(): void {
    const defaultTemplates: PromptTemplate[] = [
      {
        id: 'transcript-summary',
        name: 'Transcript Summary',
        description: 'Generate a comprehensive summary of a transcript',
        template: `Please provide a comprehensive summary of the following transcript.

Focus on:
- Key topics and themes discussed
- Important decisions made
- Action items and next steps
- Main participants and their contributions

{{#if language}}
Please respond in {{language}}.
{{/if}}

Transcript:
{{transcript}}`,
        variables: ['transcript', 'language'],
        category: 'summarization',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'extract-tasks',
        name: 'Extract Tasks',
        description: 'Extract actionable tasks from a transcript',
        template: `Analyze the following transcript and extract all actionable tasks, action items, and to-dos mentioned.

For each task, provide:
- Clear description of what needs to be done
- Who is responsible (if mentioned)
- Any deadlines or timeframes mentioned
- Priority level (if indicated)

Format as a structured list.

{{#if context}}
Context: {{context}}
{{/if}}

Transcript:
{{transcript}}`,
        variables: ['transcript', 'context'],
        category: 'extraction',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'extract-decisions',
        name: 'Extract Decisions',
        description: 'Extract decisions made during a conversation',
        template: `Analyze the following transcript and extract all decisions that were made.

For each decision, provide:
- What was decided
- Who made the decision
- The reasoning behind it (if mentioned)
- Any alternatives that were considered

Format as a structured list.

Transcript:
{{transcript}}`,
        variables: ['transcript'],
        category: 'extraction',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'extract-questions',
        name: 'Extract Questions',
        description: 'Extract questions and concerns raised in a transcript',
        template: `Analyze the following transcript and extract all questions, concerns, and issues that were raised.

For each item, provide:
- The question or concern
- Who raised it
- Whether it was answered/resolved
- Any follow-up needed

Format as a structured list.

Transcript:
{{transcript}}`,
        variables: ['transcript'],
        category: 'extraction',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'psychology-analysis',
        name: 'Psychological Analysis',
        description: 'Analyze psychological indicators in speech patterns',
        template: `Analyze this transcript for comprehensive psychological insights. Focus on emotional state, mood patterns, and mental well-being indicators.

ANALYZE THE FOLLOWING DIMENSIONS:

1. MOOD ASSESSMENT (scale 1-10 for each):
   - Happy/Positive
   - Sad/Melancholic  
   - Anxious/Worried
   - Stressed/Overwhelmed
   - Calm/Peaceful
   - Excited/Energetic
   - Frustrated/Irritated
   - Confident/Assured

2. ENERGY LEVEL (1-10): Overall energy and vitality

3. STRESS LEVEL (1-10): Perceived stress and tension

4. CONFIDENCE LEVEL (1-10): Self-assurance and certainty

5. ENGAGEMENT LEVEL (1-10): Interest and involvement in topics

6. EMOTIONAL STATE:
   - Dominant emotion
   - Secondary emotions
   - Emotional stability (1-10)
   - Emotional intensity (1-10)

7. SPEECH PATTERNS:
   - Pace (slow/normal/fast)
   - Tone (positive/neutral/negative)
   - Hesitation count
   - Interruption count
   - Vocal tension (1-10)

8. KEY INSIGHTS: Brief summary of psychological state

Return a valid JSON object with this exact structure:
{
  "mood": {
    "happy": 7,
    "sad": 2,
    "anxious": 4,
    "stressed": 3,
    "calm": 6,
    "excited": 8,
    "frustrated": 2,
    "confident": 7
  },
  "energy": 8,
  "stress_level": 3,
  "confidence": 7,
  "engagement": 9,
  "emotional_state": {
    "dominant_emotion": "excited",
    "secondary_emotions": ["confident", "happy"],
    "emotional_stability": 7,
    "emotional_intensity": 8
  },
  "speech_patterns": {
    "pace": "fast",
    "tone": "positive",
    "hesitation_count": 3,
    "interruption_count": 1,
    "vocal_tension": 2
  },
  "key_insights": "Individual shows high energy and engagement with positive outlook..."
}

Transcript:
{{transcript}}`,
        variables: ['transcript'],
        category: 'analysis',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }
  }

  getTemplate(id: string): PromptTemplate | null {
    return this.templates.get(id) || null;
  }

  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    this._logger.info(`Added prompt template: ${template.id}`);
  }

  updateTemplate(id: string, updates: Partial<PromptTemplate>): boolean {
    const existing = this.templates.get(id);
    if (!existing) {
      return false;
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.templates.set(id, updated);
    this._logger.info(`Updated prompt template: ${id}`);
    return true;
  }

  removeTemplate(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this._logger.info(`Removed prompt template: ${id}`);
    }
    return deleted;
  }

  renderPrompt(templateId: string, variables: PromptVariables): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return this.interpolateTemplate(template.template, variables);
  }

  private interpolateTemplate(template: string, variables: PromptVariables): string {
    let result = template;

    // Simple variable substitution: {{variable}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }

    // Simple conditional blocks: {{#if variable}}...{{/if}}
    result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
      const value = variables[varName];
      return value ? content : '';
    });

    // Remove any remaining unresolved variables
    result = result.replace(/{{[^}]+}}/g, '');

    return result.trim();
  }

  validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for balanced conditional blocks
    const ifMatches = template.match(/{{#if\s+\w+}}/g) || [];
    const endifMatches = template.match(/{{\/if}}/g) || [];

    if (ifMatches.length !== endifMatches.length) {
      errors.push('Unbalanced conditional blocks ({{#if}} and {{/if}})');
    }

    // Extract variables
    const variableMatches = template.match(/{{(\w+)}}/g) || [];
    const variables = variableMatches.map(match => match.replace(/[{}]/g, ''));

    // Check for required variables
    if (!variables.includes('transcript')) {
      errors.push('Template must include {{transcript}} variable');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  extractVariables(template: string): string[] {
    const matches = template.match(/{{(\w+)}}/g) || [];
    const variables = matches.map(match => match.replace(/[{}]/g, ''));
    return Array.from(new Set(variables)); // Remove duplicates
  }
}
