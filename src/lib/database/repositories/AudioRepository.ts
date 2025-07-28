import { BaseRepository } from './BaseRepository';
import { audioFiles, AudioFile, NewAudioFile } from '../schema';
import { getDb } from '../client';
import { eq, desc, asc, and, gte, lte, SQL, sum, avg, count } from 'drizzle-orm';

export class AudioRepository extends BaseRepository<AudioFile, NewAudioFile> {
  constructor() {
    super(audioFiles);
  }

  async findByHash(hash: string): Promise<AudioFile | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.fileHash, hash))
        .limit(1);
      return (result[0] as AudioFile) || null;
    } catch (error) {
      throw new Error(`Failed to find audio file by hash: ${error}`);
    }
  }

  async findByFileName(fileName: string): Promise<AudioFile | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.fileName, fileName))
        .limit(1);
      return (result[0] as AudioFile) || null;
    } catch (error) {
      throw new Error(`Failed to find audio file by filename: ${error}`);
    }
  }

  async findRecent(limit: number = 10): Promise<AudioFile[]> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .orderBy(desc(this.table.uploadedAt))
        .limit(limit);
      return result as AudioFile[];
    } catch (error) {
      throw new Error(`Failed to find recent audio files: ${error}`);
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AudioFile[]> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(
          and(
            gte(this.table.uploadedAt, Math.floor(startDate.getTime() / 1000)),
            lte(this.table.uploadedAt, Math.floor(endDate.getTime() / 1000)),
          ),
        )
        .orderBy(desc(this.table.uploadedAt));
      return result as AudioFile[];
    } catch (error) {
      throw new Error(`Failed to find audio files by date range: ${error}`);
    }
  }

  async findByFileType(fileType: string): Promise<AudioFile[]> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table.originalFileType, fileType))
        .orderBy(desc(this.table.uploadedAt));
      return result as AudioFile[];
    } catch (error) {
      throw new Error(`Failed to find audio files by file type: ${error}`);
    }
  }

  async getTotalSize(): Promise<number> {
    try {
      const db = getDb();
      const result = await db
        .select({ totalSize: sum(this.table.fileSize) })
        .from(this.table);
      return Number(result[0]?.totalSize) || 0;
    } catch (error) {
      throw new Error(`Failed to get total file size: ${error}`);
    }
  }

  async getStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
    averageDuration: number;
  }> {
    try {
      const db = getDb();
      const result = await db
        .select({
          totalFiles: count(),
          totalSize: sum(this.table.fileSize),
          averageSize: avg(this.table.fileSize),
          averageDuration: avg(this.table.duration),
        })
        .from(this.table);

      const stats = result[0];
      return {
        totalFiles: Number(stats?.totalFiles) || 0,
        totalSize: Number(stats?.totalSize) || 0,
        averageSize: Number(stats?.averageSize) || 0,
        averageDuration: Number(stats?.averageDuration) || 0,
      };
    } catch (error) {
      throw new Error(`Failed to get audio file statistics: ${error}`);
    }
  }

  async getUniqueDates(): Promise<string[]> {
    try {
      const db = getDb();
      // This is a simplified version - in production, you'd want to use SQL functions
      // to extract unique dates from the uploadedAt timestamp
      const files = await db
        .select({
          uploadedAt: this.table.uploadedAt,
        })
        .from(this.table)
        .orderBy(desc(this.table.uploadedAt));

      const uniqueDates = new Set<string>();
      files.forEach(file => {
        if (file.uploadedAt) {
          const date = new Date(file.uploadedAt).toISOString().split('T')[0];
          uniqueDates.add(date);
        }
      });

      return Array.from(uniqueDates).sort().reverse();
    } catch (error) {
      throw new Error(`Failed to get unique dates: ${error}`);
    }
  }

  async updateTimestamp(id: number): Promise<AudioFile> {
    try {
      const db = getDb();
      const [result] = await db
        .update(this.table)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(this.table.id, id))
        .returning();

      if (!result) {
        throw new Error(`Audio file with id ${id} not found`);
      }

      return result as AudioFile;
    } catch (error) {
      throw new Error(`Failed to update timestamp: ${error}`);
    }
  }
}
