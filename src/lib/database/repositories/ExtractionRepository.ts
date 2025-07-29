import { BaseRepository } from './BaseRepository';
import { extractions, Extraction, NewExtraction } from '../schema';
import { getDb } from '../client';
import { eq, and, desc, asc } from 'drizzle-orm';

export class ExtractionRepository extends BaseRepository<
  Extraction,
  NewExtraction
> {
  constructor() {
    super(extractions);
  }

  async findByFileId(fileId: number): Promise<Extraction[]> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.fileId, fileId))
        .orderBy(desc(this.table.createdAt));
      return result as Extraction[];
    } catch (error) {
      throw new Error(`Failed to find extractions by file ID: ${error}`);
    }
  }

  async findByTemplateId(templateId: string): Promise<Extraction[]> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.templateId, templateId))
        .orderBy(desc(this.table.createdAt));
      return result as Extraction[];
    } catch (error) {
      throw new Error(`Failed to find extractions by template ID: ${error}`);
    }
  }

  async findByStatus(status: string): Promise<Extraction[]> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.status, status))
        .orderBy(desc(this.table.createdAt));
      return result as Extraction[];
    } catch (error) {
      throw new Error(`Failed to find extractions by status: ${error}`);
    }
  }

  async findByPriority(priority: string): Promise<Extraction[]> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.priority, priority))
        .orderBy(desc(this.table.createdAt));
      return result as Extraction[];
    } catch (error) {
      throw new Error(`Failed to find extractions by priority: ${error}`);
    }
  }

  async findByFileAndTemplate(
    fileId: number,
    templateId: string,
  ): Promise<Extraction[]> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(
          and(
            eq(this.table.fileId, fileId),
            eq(this.table.templateId, templateId),
          ),
        )
        .orderBy(desc(this.table.createdAt));
      return result as Extraction[];
    } catch (error) {
      throw new Error(
        `Failed to find extractions by file and template: ${error}`,
      );
    }
  }

  async updateStatus(id: string, status: string): Promise<Extraction> {
    try {
      const db = getDb();
      const [result] = await db
        .update(this.table)
        .set({
          status,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error(`Extraction with id ${id} not found`);
      }

      return result as Extraction;
    } catch (error) {
      throw new Error(`Failed to update extraction status: ${error}`);
    }
  }

  async addComment(id: string, comment: string): Promise<Extraction> {
    try {
      const db = getDb();
      const [result] = await db
        .update(this.table)
        .set({
          comments: comment,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error(`Extraction with id ${id} not found`);
      }

      return result as Extraction;
    } catch (error) {
      throw new Error(`Failed to add comment to extraction: ${error}`);
    }
  }
}
