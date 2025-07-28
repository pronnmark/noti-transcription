import { BaseRepository } from './BaseRepository';
import { summarizations, Summarization, NewSummarization } from '../schema';
import { getDb } from '../client';
import { eq, desc } from 'drizzle-orm';

export class SummarizationRepository extends BaseRepository<Summarization, NewSummarization> {
  constructor() {
    super(summarizations);
  }

  async countByFileId(fileId: number): Promise<number> {
    try {
      const result = await getDb()
        .select()
        .from(this.table)
        .where(eq(this.table.fileId, fileId));
      return result.length;
    } catch (error) {
      throw new Error(`Failed to count summarizations by file ID: ${error}`);
    }
  }

  async findByFileId(fileId: number): Promise<Summarization[]> {
    try {
      const result = await getDb()
        .select()
        .from(this.table)
        .where(eq(this.table.fileId, fileId))
        .orderBy(desc(this.table.createdAt));
      return result as Summarization[];
    } catch (error) {
      throw new Error(`Failed to find summarizations by file ID: ${error}`);
    }
  }

  async findLatestByFileId(fileId: number): Promise<Summarization | null> {
    try {
      const result = await getDb()
        .select()
        .from(this.table)
        .where(eq(this.table.fileId, fileId))
        .orderBy(desc(this.table.createdAt))
        .limit(1);
      return (result[0] as Summarization) || null;
    } catch (error) {
      throw new Error(`Failed to find latest summarization: ${error}`);
    }
  }

  async findByTemplateId(templateId: string): Promise<Summarization[]> {
    try {
      const result = await getDb()
        .select()
        .from(this.table)
        .where(eq(this.table.templateId, templateId))
        .orderBy(desc(this.table.createdAt));
      return result as Summarization[];
    } catch (error) {
      throw new Error(`Failed to find summarizations by template ID: ${error}`);
    }
  }

  async findByModel(model: string): Promise<Summarization[]> {
    try {
      const result = await getDb()
        .select()
        .from(this.table)
        .where(eq(this.table.model, model))
        .orderBy(desc(this.table.createdAt));
      return result as Summarization[];
    } catch (error) {
      throw new Error(`Failed to find summarizations by model: ${error}`);
    }
  }
}
