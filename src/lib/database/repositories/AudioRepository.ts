import { BaseRepository } from './BaseRepository';
import { AudioFile } from '../client';
import { IAudioRepository, FindAllOptions, DuplicateCheckData } from '../interfaces/repositories';
import { DatabaseClient } from '../interfaces/DatabaseClient';

export class AudioRepository extends BaseRepository implements IAudioRepository {
  constructor(db: DatabaseClient) {
    super(db);
  }
  async findByHash(hash: string): Promise<AudioFile | null> {
    this.validateRequired(hash, 'Find audio file by hash');
    
    return this.executeQueryWithNull<AudioFile>(
      'Find audio file by hash',
      () => this.db
        .from<AudioFile>('audio_files')
        .select('*')
        .eq('file_hash', hash)
        .limit(1)
        .single()
        .execute()
    );
  }

  async findAll(options?: FindAllOptions): Promise<AudioFile[]> {
    return this.executeQuery<AudioFile[]>(
      'Find all audio files',
      async () => {
        let query = this.db.from<AudioFile[]>('audio_files').select('*');

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

        return query.execute();
      }
    );
  }

  async findById(id: number): Promise<AudioFile | null> {
    this.validateId(id, 'Find audio file by ID');
    
    return this.executeQueryWithNull<AudioFile>(
      'Find audio file by ID',
      () => this.db
        .from<AudioFile>('audio_files')
        .select('*')
        .eq('id', id)
        .single()
        .execute()
    );
  }

  async create(
    data: Omit<AudioFile, 'id' | 'uploaded_at' | 'updated_at'>
  ): Promise<AudioFile> {
    this.validateRequired(data, 'Create audio file');
    
    return this.executeQuery<AudioFile>(
      'Create audio file',
      () => this.db
        .from<AudioFile>('audio_files')
        .insert(data)
        .select('*')
        .single()
        .execute()
    );
  }

  async update(
    id: number,
    data: Partial<Omit<AudioFile, 'id' | 'uploaded_at' | 'updated_at'>>
  ): Promise<AudioFile> {
    this.validateId(id, 'Update audio file');
    this.validateRequired(data, 'Update audio file');
    
    return this.executeQuery<AudioFile>(
      'Update audio file',
      () => this.db
        .from<AudioFile>('audio_files')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single()
        .execute()
    );
  }

  async delete(id: number): Promise<boolean> {
    this.validateId(id, 'Delete audio file');
    
    return this.executeBooleanQuery(
      'Delete audio file',
      () => this.db
        .from<AudioFile>('audio_files')
        .delete()
        .eq('id', id)
        .execute()
    );
  }

  async checkForDuplicates(data: {
    fileHash: string;
    fileSize: number;
    originalFileName: string;
  }): Promise<AudioFile[]> {
    this.validateRequired(data, 'Check for duplicates');
    
    return this.executeQuery<AudioFile[]>(
      'Check for duplicates',
      () => this.db
        .from<AudioFile[]>('audio_files')
        .select('*')
        .or(
          `file_hash.eq.${data.fileHash},and(file_size.eq.${data.fileSize},original_file_name.eq.${data.originalFileName})`
        )
        .execute()
    );
  }

  async count(): Promise<number> {
    return this.executeCountQuery(
      'Count audio files',
      () => this.db
        .from('audio_files')
        .select('*', { count: 'exact', head: true })
        .execute()
    );
  }

  // Storage stats moved to AudioStatsRepository for better separation of concerns

  async updateTimestamp(id: number): Promise<void> {
    this.validateId(id, 'Update timestamp');
    
    await this.executeBooleanQuery(
      'Update timestamp',
      () => this.db
        .from<AudioFile>('audio_files')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .execute()
    );
  }

  async findByFileName(fileName: string): Promise<AudioFile | null> {
    this.validateRequired(fileName, 'Find audio file by file name');
    
    return this.executeQueryWithNull<AudioFile>(
      'Find audio file by file name',
      () => this.db
        .from<AudioFile>('audio_files')
        .select('*')
        .eq('file_name', fileName)
        .single()
        .execute()
    );
  }

  async findRecent(limit: number = 10): Promise<AudioFile[]> {
    return this.executeQuery<AudioFile[]>(
      'Find recent audio files',
      () => this.db
        .from<AudioFile[]>('audio_files')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(limit)
        .execute()
    );
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AudioFile[]> {
    this.validateRequired(startDate, 'Find by date range - start date');
    this.validateRequired(endDate, 'Find by date range - end date');
    
    return this.executeQuery<AudioFile[]>(
      'Find audio files by date range',
      () => this.db
        .from<AudioFile[]>('audio_files')
        .select('*')
        .gte('uploaded_at', startDate.toISOString())
        .lte('uploaded_at', endDate.toISOString())
        .order('uploaded_at', { ascending: false })
        .execute()
    );
  }

  /**
   * Delete all records - USE WITH EXTREME CAUTION (for testing only)
   */
  async deleteAll(): Promise<void> {
    await this.executeBooleanQuery(
      'Delete all audio files',
      () => this.db
        .from<AudioFile>('audio_files')
        .delete()
        .neq('id', 0) // Delete all where id != 0 (i.e., all records)
        .execute()
    );
  }
}
