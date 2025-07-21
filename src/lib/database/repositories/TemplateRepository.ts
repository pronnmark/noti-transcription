import { BaseRepository } from './BaseRepository';
import { 
  extractionTemplates, 
  ExtractionTemplate, 
  NewExtractionTemplate,
  summarizationTemplates,
  SummarizationTemplate,
  NewSummarizationTemplate
} from '../schema';
import { getDb } from '../client';
import { eq, desc } from 'drizzle-orm';

export class ExtractionTemplateRepository extends BaseRepository<ExtractionTemplate, NewExtractionTemplate> {
  constructor() {
    super(extractionTemplates);
  }

  async findActive(): Promise<ExtractionTemplate[]> {
    try {
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.isActive, true))
        .orderBy(desc(this.table.createdAt));
      return result as ExtractionTemplate[];
    } catch (error) {
      throw new Error(`Failed to find active extraction templates: ${error}`);
    }
  }

  async findDefault(): Promise<ExtractionTemplate[]> {
    try {
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.isDefault, true))
        .orderBy(desc(this.table.createdAt));
      return result as ExtractionTemplate[];
    } catch (error) {
      throw new Error(`Failed to find default extraction templates: ${error}`);
    }
  }

  async findByName(name: string): Promise<ExtractionTemplate | null> {
    try {
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.name, name))
        .limit(1);
      return (result[0] as ExtractionTemplate) || null;
    } catch (error) {
      throw new Error(`Failed to find extraction template by name: ${error}`);
    }
  }

  async setDefault(id: string): Promise<ExtractionTemplate> {
    try {
      // First, unset all other defaults
      await db
        .update(this.table)
        .set({ isDefault: false })
        .where(eq(this.table.isDefault, true));

      // Then set this one as default
      const [result] = await db
        .update(this.table)
        .set({ 
          isDefault: true,
          updatedAt: new Date().toISOString()
        })
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error(`Extraction template with id ${id} not found`);
      }

      return result as ExtractionTemplate;
    } catch (error) {
      throw new Error(`Failed to set default extraction template: ${error}`);
    }
  }

  async toggleActive(id: string): Promise<ExtractionTemplate> {
    try {
      // First get current state
      const current = await this.findById(id);
      if (!current) {
        throw new Error(`Extraction template with id ${id} not found`);
      }

      const [result] = await db
        .update(this.table)
        .set({ 
          isActive: !current.isActive,
          updatedAt: new Date().toISOString()
        })
        .where(eq(this.table.id, id))
        .returning();

      return result as ExtractionTemplate;
    } catch (error) {
      throw new Error(`Failed to toggle extraction template active state: ${error}`);
    }
  }
}

export class SummarizationTemplateRepository extends BaseRepository<SummarizationTemplate, NewSummarizationTemplate> {
  constructor() {
    super(summarizationTemplates);
  }

  async findByTitle(title: string): Promise<SummarizationTemplate | null> {
    try {
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.title, title))
        .limit(1);
      return (result[0] as SummarizationTemplate) || null;
    } catch (error) {
      throw new Error(`Failed to find summarization template by title: ${error}`);
    }
  }

  async findRecent(limit: number = 10): Promise<SummarizationTemplate[]> {
    try {
      const result = await db
        .select()
        .from(this.table)
        .orderBy(desc(this.table.createdAt))
        .limit(limit);
      return result as SummarizationTemplate[];
    } catch (error) {
      throw new Error(`Failed to find recent summarization templates: ${error}`);
    }
  }
}
