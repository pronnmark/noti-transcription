import { BaseRepository } from './BaseRepository';
import { getSupabase } from '../client';

interface SummarizationCreateData {
  file_id: number;
  content: string;
  model: string;
  prompt: string;
  template_id?: string | null;
}

interface Summarization {
  id: number;
  file_id: number;
  content: string;
  model: string;
  prompt: string;
  template_id?: string | null;
  created_at: string;
  updated_at: string;
}

// Placeholder repository - update with actual Supabase schema when needed
export class SummarizationRepository extends BaseRepository {
  // TODO: Implement Supabase-based summarization repository methods

  async findActiveByIds(ids: string[]): Promise<any[]> {
    // Throw error instead of silently failing
    throw new Error(
      'Summarization templates feature not yet implemented - summarization_templates table missing'
    );
  }

  async create(data: SummarizationCreateData): Promise<Summarization> {
    const supabase = getSupabase();

    const { data: result, error } = await supabase
      .from('summarizations')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Failed to create summarization:', error);
      throw new Error(`Failed to create summarization: ${error.message}`);
    }

    return result;
  }
}
