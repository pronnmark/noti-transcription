import { BaseRepository } from "./BaseRepository";
import { transcriptionJobs, TranscriptionJob, NewTranscriptionJob, TranscriptSegment } from "../schema";
import { getDb } from "../client";
import { eq, and, desc } from "drizzle-orm";

export class TranscriptionRepository extends BaseRepository<TranscriptionJob, NewTranscriptionJob> {
  constructor() {
    super(transcriptionJobs);
  }

  async findByFileId(fileId: number): Promise<TranscriptionJob[]> {
    try {
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.fileId, fileId))
        .orderBy(desc(this.table.createdAt));
      return result as TranscriptionJob[];
    } catch (error) {
      throw new Error(`Failed to find transcription jobs by file ID: ${error}`);
    }
  }

  async findLatestByFileId(fileId: number): Promise<TranscriptionJob | null> {
    try {
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.fileId, fileId))
        .orderBy(desc(this.table.createdAt))
        .limit(1);
      return (result[0] as TranscriptionJob) || null;
    } catch (error) {
      throw new Error(`Failed to find latest transcription job: ${error}`);
    }
  }

  async findByStatus(status: string): Promise<TranscriptionJob[]> {
    try {
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.status, status))
        .orderBy(desc(this.table.createdAt));
      return result as TranscriptionJob[];
    } catch (error) {
      throw new Error(`Failed to find transcription jobs by status: ${error}`);
    }
  }

  async updateStatus(id: number, status: string, error?: string): Promise<TranscriptionJob> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (status === 'processing') {
        updateData.startedAt = new Date();
      } else if (status === 'completed') {
        updateData.completedAt = new Date();
      } else if (status === 'failed' && error) {
        updateData.lastError = error;
      }

      const [result] = await db
        .update(this.table)
        .set(updateData)
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error(`Transcription job with id ${id} not found`);
      }

      return result as TranscriptionJob;
    } catch (error) {
      throw new Error(`Failed to update transcription job status: ${error}`);
    }
  }

  async updateProgress(id: number, progress: number): Promise<TranscriptionJob> {
    try {
      const [result] = await db
        .update(this.table)
        .set({
          progress,
          updatedAt: new Date()
        })
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error(`Transcription job with id ${id} not found`);
      }

      return result as TranscriptionJob;
    } catch (error) {
      throw new Error(`Failed to update transcription progress: ${error}`);
    }
  }

  async completeTranscription(
    id: number,
    transcript: TranscriptSegment[]
  ): Promise<TranscriptionJob> {
    try {
      const [result] = await db
        .update(this.table)
        .set({
          transcript,
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error(`Transcription job with id ${id} not found`);
      }

      return result as TranscriptionJob;
    } catch (error) {
      throw new Error(`Failed to complete transcription: ${error}`);
    }
  }
}
