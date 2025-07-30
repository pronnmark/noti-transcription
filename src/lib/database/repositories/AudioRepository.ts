import { BaseRepository } from './BaseRepository';
import { AudioFile } from '../client';
import { getSupabase } from '../client';

export class AudioRepository extends BaseRepository {
  async findByHash(hash: string): Promise<AudioFile | null> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .eq('file_hash', hash)
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null;
        }
        throw new Error(
          `Supabase error: ${error.message || JSON.stringify(error)}`
        );
      }

      return data as AudioFile;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        `Failed to find audio file by hash: ${JSON.stringify(error)}`
      );
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'uploaded_at' | 'updated_at' | 'file_name';
    sortOrder?: 'asc' | 'desc';
  }): Promise<AudioFile[]> {
    try {
      const supabase = getSupabase();
      let query = supabase.from('audio_files').select('*');

      // Apply sorting
      const sortBy = options?.sortBy || 'uploaded_at';
      const sortOrder = options?.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1
        );
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data as AudioFile[];
    } catch (error) {
      throw new Error(
        `Failed to find all audio files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findById(id: number): Promise<AudioFile | null> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data as AudioFile;
    } catch (error) {
      throw new Error(
        `Failed to find audio file by ID: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async create(
    data: Omit<AudioFile, 'id' | 'uploaded_at' | 'updated_at'>
  ): Promise<AudioFile> {
    try {
      const supabase = getSupabase();
      const { data: newFile, error } = await supabase
        .from('audio_files')
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error('Supabase create error:', error);
        throw error;
      }

      return newFile as AudioFile;
    } catch (error) {
      console.error('AudioRepository.create error:', error);
      throw new Error(
        `Failed to create audio file: ${error instanceof Error ? error.message : JSON.stringify(error)}`
      );
    }
  }

  async update(
    id: number,
    data: Partial<Omit<AudioFile, 'id' | 'uploaded_at' | 'updated_at'>>
  ): Promise<AudioFile> {
    try {
      const supabase = getSupabase();
      const { data: updatedFile, error } = await supabase
        .from('audio_files')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return updatedFile as AudioFile;
    } catch (error) {
      throw new Error(
        `Failed to update audio file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('audio_files')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(
        `Failed to delete audio file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async checkForDuplicates(data: {
    fileHash: string;
    fileSize: number;
    originalFileName: string;
  }): Promise<AudioFile[]> {
    try {
      const supabase = getSupabase();
      const { data: duplicates, error } = await supabase
        .from('audio_files')
        .select('*')
        .or(
          `file_hash.eq.${data.fileHash},and(file_size.eq.${data.fileSize},original_file_name.eq.${data.originalFileName})`
        );

      if (error) {
        throw error;
      }

      return duplicates as AudioFile[];
    } catch (error) {
      throw new Error(
        `Failed to check for duplicates: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async count(): Promise<number> {
    try {
      const supabase = getSupabase();
      const { count, error } = await supabase
        .from('audio_files')
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      throw new Error(
        `Failed to count audio files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
    totalDuration: number;
  }> {
    try {
      const supabase = getSupabase();

      // Get count and sum in separate queries since Supabase doesn't support aggregate functions the same way
      const { count } = await supabase
        .from('audio_files')
        .select('*', { count: 'exact', head: true });

      const { data: sizeData } = await supabase
        .from('audio_files')
        .select('file_size, duration');

      const totalFiles = count || 0;
      const totalSize =
        sizeData?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
      const totalDuration =
        sizeData?.reduce((sum, file) => sum + (file.duration || 0), 0) || 0;
      const averageSize = totalFiles > 0 ? totalSize / totalFiles : 0;

      return {
        totalFiles,
        totalSize,
        averageSize,
        totalDuration,
      };
    } catch (error) {
      throw new Error(
        `Failed to get storage stats: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async updateTimestamp(id: number): Promise<void> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('audio_files')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new Error(
        `Failed to update timestamp: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findByFileName(fileName: string): Promise<AudioFile | null> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .eq('file_name', fileName)
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null;
        }
        throw error;
      }

      return data as AudioFile;
    } catch (error) {
      throw new Error(
        `Failed to find audio file by fileName: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findRecent(limit: number = 10): Promise<AudioFile[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data as AudioFile[];
    } catch (error) {
      throw new Error(
        `Failed to find recent audio files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AudioFile[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .gte('uploaded_at', startDate.toISOString())
        .lte('uploaded_at', endDate.toISOString())
        .order('uploaded_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as AudioFile[];
    } catch (error) {
      throw new Error(
        `Failed to find audio files by date range: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete all records - USE WITH EXTREME CAUTION (for testing only)
   */
  async deleteAll(): Promise<void> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('audio_files')
        .delete()
        .neq('id', 0); // Delete all where id != 0 (i.e., all records)

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new Error(
        `Failed to delete all audio files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
