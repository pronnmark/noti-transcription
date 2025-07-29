import { BaseRepository } from './BaseRepository';
import { TranscriptionJob } from '../client';
import { getSupabase } from '../client';

export class TranscriptionRepository extends BaseRepository {
  async create(data: Omit<TranscriptionJob, 'id' | 'created_at' | 'updated_at'>): Promise<TranscriptionJob> {
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
      throw new Error(`Failed to create transcription job: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
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
      throw new Error(`Failed to find latest transcription job: ${error instanceof Error ? error.message : String(error)}`);
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
      throw new Error(`Failed to find transcription job by ID: ${error instanceof Error ? error.message : String(error)}`);
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
      throw new Error(`Failed to find transcription jobs by file ID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateStatus(id: number, status: TranscriptionJob['status'], options?: {
    progress?: number;
    lastError?: string;
    startedAt?: string;
    completedAt?: string;
    transcript?: any;
  }): Promise<TranscriptionJob> {
    try {
      const supabase = getSupabase();
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };
      
      if (options?.progress !== undefined) updateData.progress = options.progress;
      if (options?.lastError) updateData.last_error = options.lastError;
      if (options?.startedAt) updateData.started_at = options.startedAt;
      if (options?.completedAt) updateData.completed_at = options.completedAt;
      if (options?.transcript) updateData.transcript = JSON.stringify(options.transcript);
      
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
      throw new Error(`Failed to update transcription job status: ${error instanceof Error ? error.message : String(error)}`);
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
      throw new Error(`Failed to find pending transcription jobs: ${error instanceof Error ? error.message : String(error)}`);
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
      throw new Error(`Failed to delete transcription job: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}