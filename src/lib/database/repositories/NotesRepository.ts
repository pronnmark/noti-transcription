import { BaseRepository } from './BaseRepository';
import { notes, Note, NewNote } from '../schema/notes';
import { audioFiles } from '../schema/audio';
import { getDb } from '../client';
import { eq, desc } from 'drizzle-orm';

export class NotesRepository extends BaseRepository<Note, NewNote> {
  constructor() {
    super(notes);
  }

  async findByFileId(fileId: number): Promise<Array<Note & { originalFileName?: string }>> {
    try {
      const db = getDb();
      const result = await db
        .select({
          id: this.table.id,
          fileId: this.table.fileId,
          content: this.table.content,
          createdAt: this.table.createdAt,
          updatedAt: this.table.updatedAt,
          originalFileName: audioFiles.originalFileName,
        })
        .from(this.table)
        .leftJoin(audioFiles, eq(this.table.fileId, audioFiles.id))
        .where(eq(this.table.fileId, fileId))
        .orderBy(desc(this.table.createdAt));

      return result as Array<Note & { originalFileName?: string }>;
    } catch (error) {
      throw new Error(`Failed to find notes by file ID: ${error}`);
    }
  }

  async findAllWithFileInfo(limit: number = 100): Promise<Array<Note & { originalFileName?: string }>> {
    try {
      const db = getDb();
      const result = await db
        .select({
          id: this.table.id,
          fileId: this.table.fileId,
          content: this.table.content,
          createdAt: this.table.createdAt,
          updatedAt: this.table.updatedAt,
          originalFileName: audioFiles.originalFileName,
        })
        .from(this.table)
        .leftJoin(audioFiles, eq(this.table.fileId, audioFiles.id))
        .orderBy(desc(this.table.createdAt))
        .limit(limit);

      return result as Array<Note & { originalFileName?: string }>;
    } catch (error) {
      throw new Error(`Failed to find all notes: ${error}`);
    }
  }

  async updateContent(id: string, content: string): Promise<Note> {
    try {
      const db = getDb();
      const [result] = await db
        .update(this.table)
        .set({
          content,
          updatedAt: new Date(),
        })
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error(`Note with id ${id} not found`);
      }

      return result as Note;
    } catch (error) {
      throw new Error(`Failed to update note content: ${error}`);
    }
  }
}