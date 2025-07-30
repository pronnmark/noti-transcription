import { BaseRepository } from './BaseRepository';
import { IAudioStatsRepository, AudioStorageStats, AudioUsageStats } from '../interfaces/repositories';
import { DatabaseClient } from '../interfaces/DatabaseClient';

/**
 * Audio Statistics Repository
 * 
 * Separated from AudioRepository to follow Single Responsibility Principle.
 * Handles all analytics and statistics operations for audio files.
 */
export class AudioStatsRepository extends BaseRepository implements IAudioStatsRepository {
  constructor(db: DatabaseClient) {
    super(db);
  }

  async getStorageStats(): Promise<AudioStorageStats> {
    return this.executeQuery<AudioStorageStats>(
      'Get storage statistics',
      async () => {
        // Get count
        const countResult = await this.db
          .from('audio_files')
          .select('*', { count: 'exact', head: true })
          .execute();

        if (countResult.error) {
          return { data: null, error: countResult.error };
        }

        // Get size and duration data
        const dataResult = await this.db
          .from('audio_files')
          .select('file_size, duration')
          .execute();

        if (dataResult.error) {
          return { data: null, error: dataResult.error };
        }

        const totalFiles = countResult.count || 0;
        const files = dataResult.data || [];
        
        const totalSize = files.reduce((sum: number, file: any) => 
          sum + (file.file_size || 0), 0
        );
        
        const totalDuration = files.reduce((sum: number, file: any) => 
          sum + (file.duration || 0), 0
        );
        
        const averageSize = totalFiles > 0 ? totalSize / totalFiles : 0;

        const stats: AudioStorageStats = {
          totalFiles,
          totalSize,
          averageSize,
          totalDuration,
        };

        return { data: stats, error: null };
      }
    );
  }

  async getUsageStats(period: 'day' | 'week' | 'month'): Promise<AudioUsageStats> {
    return this.executeQuery<AudioUsageStats>(
      `Get usage statistics for ${period}`,
      async () => {
        const now = new Date();
        let startDate: Date;

        switch (period) {
          case 'day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }

        // Get uploads in period
        const uploadsResult = await this.db
          .from('audio_files')
          .select('*', { count: 'exact', head: true })
          .gte('uploaded_at', startDate.toISOString())
          .execute();

        if (uploadsResult.error) {
          return { data: null, error: uploadsResult.error };
        }

        // Get transcriptions in period
        const transcriptionsResult = await this.db
          .from('transcription_jobs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString())
          .execute();

        if (transcriptionsResult.error) {
          return { data: null, error: transcriptionsResult.error };
        }

        // Get storage used in period
        const storageResult = await this.db
          .from('audio_files')
          .select('file_size')
          .gte('uploaded_at', startDate.toISOString())
          .execute();

        if (storageResult.error) {
          return { data: null, error: storageResult.error };
        }

        const files = storageResult.data || [];
        const storageUsedInPeriod = files.reduce((sum: number, file: any) => 
          sum + (file.file_size || 0), 0
        );

        const stats: AudioUsageStats = {
          uploadsInPeriod: uploadsResult.count || 0,
          transcriptionsInPeriod: transcriptionsResult.count || 0,
          storageUsedInPeriod,
        };

        return { data: stats, error: null };
      }
    );
  }

  async getTopFilesBySize(limit: number = 10): Promise<Array<{
    id: number;
    originalFileName: string;
    fileSize: number;
    uploadedAt: string;
  }>> {
    return this.executeQuery(
      'Get top files by size',
      async () => {
        const result = await this.db
          .from('audio_files')
          .select('id, original_file_name, file_size, uploaded_at')
          .order('file_size', { ascending: false })
          .limit(limit)
          .execute();

        if (result.error) {
          return { data: null, error: result.error };
        }

        return { data: result.data || [], error: null };
      }
    );
  }

  async getFileCountByDateRange(days: number = 30): Promise<Array<{
    date: string;
    count: number;
  }>> {
    return this.executeQuery(
      'Get file count by date range',
      async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const result = await this.db
          .from('audio_files')
          .select('uploaded_at')
          .gte('uploaded_at', startDate.toISOString())
          .order('uploaded_at', { ascending: true })
          .execute();

        if (result.error) {
          return { data: null, error: result.error };
        }

        // Group by date
        const files = result.data || [];
        const dateGroups: { [key: string]: number } = {};

        files.forEach((file: any) => {
          const date = new Date(file.uploaded_at).toISOString().split('T')[0];
          dateGroups[date] = (dateGroups[date] || 0) + 1;
        });

        const chartData = Object.entries(dateGroups).map(([date, count]) => ({
          date,
          count,
        }));

        return { data: chartData, error: null };
      }
    );
  }
}