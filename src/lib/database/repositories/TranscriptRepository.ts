import { BaseRepository } from './BaseRepository';
import { TranscriptionJob } from '../client';
import { getSupabase } from '../client';

export class TranscriptionRepository extends BaseRepository {
  async create(
    data: Omit<TranscriptionJob, 'id' | 'created_at' | 'updated_at'>
  ): Promise<TranscriptionJob> {
    try {
      const supabase = getSupabase();
      const { data: newJob, error } = await supabase
        .from('transcription_jobs')
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error('Supabase transcription create error:', error);
        throw error;
      }

      return newJob as TranscriptionJob;
    } catch (error) {
      console.error('TranscriptionRepository.create error:', error);
      throw new Error(
        `Failed to create transcription job: ${error instanceof Error ? error.message : JSON.stringify(error)}`
      );
    }
  }

  async findLatestByFileId(fileId: number): Promise<TranscriptionJob | null> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transcription_jobs')
        .select('*')
        .eq('file_id', fileId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data as TranscriptionJob;
    } catch (error) {
      throw new Error(
        `Failed to find latest transcription job: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findById(id: number): Promise<TranscriptionJob | null> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transcription_jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data as TranscriptionJob;
    } catch (error) {
      throw new Error(
        `Failed to find transcription job by ID: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findByFileId(fileId: number): Promise<TranscriptionJob[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transcription_jobs')
        .select('*')
        .eq('file_id', fileId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as TranscriptionJob[];
    } catch (error) {
      throw new Error(
        `Failed to find transcription jobs by file ID: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async updateStatus(
    id: number,
    status: TranscriptionJob['status'],
    options?: {
      progress?: number;
      lastError?: string;
      startedAt?: string;
      completedAt?: string;
      transcript?: any;
    }
  ): Promise<TranscriptionJob> {
    try {
      const supabase = getSupabase();
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (options?.progress !== undefined)
        updateData.progress = options.progress;
      if (options?.lastError) updateData.last_error = options.lastError;
      if (options?.startedAt) updateData.started_at = options.startedAt;
      if (options?.completedAt) updateData.completed_at = options.completedAt;
      if (options?.transcript)
        updateData.transcript = JSON.stringify(options.transcript);

      const { data: updatedJob, error } = await supabase
        .from('transcription_jobs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return updatedJob as TranscriptionJob;
    } catch (error) {
      throw new Error(
        `Failed to update transcription job status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async update(
    id: number,
    data: Partial<Omit<TranscriptionJob, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<TranscriptionJob> {
    try {
      const supabase = getSupabase();
      const { data: updatedJob, error } = await supabase
        .from('transcription_jobs')
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

      return updatedJob as TranscriptionJob;
    } catch (error) {
      throw new Error(
        `Failed to update transcription job: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async updateProgress(
    id: number,
    progress: number,
    status?: TranscriptionJob['status']
  ): Promise<TranscriptionJob> {
    try {
      const supabase = getSupabase();
      const updateData: any = {
        progress,
        updated_at: new Date().toISOString(),
      };

      if (status) {
        updateData.status = status;
      }

      const { data: updatedJob, error } = await supabase
        .from('transcription_jobs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return updatedJob as TranscriptionJob;
    } catch (error) {
      throw new Error(
        `Failed to update transcription progress: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async updateWithResults(
    id: number,
    data: {
      status: TranscriptionJob['status'];
      progress: number;
      transcript: any;
      completedAt: Date;
    }
  ): Promise<TranscriptionJob> {
    try {
      const supabase = getSupabase();
      const { data: updatedJob, error } = await supabase
        .from('transcription_jobs')
        .update({
          status: data.status,
          progress: data.progress,
          transcript: JSON.stringify(data.transcript),
          completed_at: data.completedAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return updatedJob as TranscriptionJob;
    } catch (error) {
      throw new Error(
        `Failed to update transcription results: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async updateWithError(
    id: number,
    data: {
      status: 'failed';
      lastError: string;
      completedAt: Date;
    }
  ): Promise<TranscriptionJob> {
    try {
      const supabase = getSupabase();
      const { data: updatedJob, error } = await supabase
        .from('transcription_jobs')
        .update({
          status: data.status,
          last_error: data.lastError,
          completed_at: data.completedAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return updatedJob as TranscriptionJob;
    } catch (error) {
      throw new Error(
        `Failed to update transcription error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findPendingJobs(limit: number = 10): Promise<TranscriptionJob[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transcription_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data as TranscriptionJob[];
    } catch (error) {
      throw new Error(
        `Failed to find pending transcription jobs: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('transcription_jobs')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(
        `Failed to delete transcription job: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findByStatus(
    status: TranscriptionJob['status']
  ): Promise<TranscriptionJob[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transcription_jobs')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as TranscriptionJob[];
    } catch (error) {
      throw new Error(
        `Failed to find transcription jobs by status: ${error instanceof Error ? error.message : String(error)}`
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
        .from('transcription_jobs')
        .delete()
        .neq('id', 0); // Delete all where id != 0 (i.e., all records)

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new Error(
        `Failed to delete all transcription jobs: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
