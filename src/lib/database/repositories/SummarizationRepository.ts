import { BaseRepository } from './BaseRepository';
import { ISummarizationRepository, SummarizationCreateData, Summarization } from '../interfaces/repositories';
import { DatabaseClient } from '../interfaces/DatabaseClient';

export class SummarizationRepository extends BaseRepository implements ISummarizationRepository {
  constructor(db: DatabaseClient) {
    super(db);
  }

  async findActiveByIds(ids: string[]): Promise<any[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    
    return this.executeQuery<any[]>(
      'Find active summarization prompts by IDs',
      () => this.db
        .from('summarization_prompts')
        .select('*')
        .or(ids.map(id => `id.eq.${id}`).join(','))
        .eq('is_active', true)
        .order('name', { ascending: true })
        .execute()
    );
  }

  async findByFileId(fileId: number): Promise<Summarization[]> {
    const summaries = await this.executeQuery<any[]>(
      'Find summarizations by file ID',
      () => this.db
        .from('summarizations')
        .select(`
          id,
          content,
          model,
          prompt,
          created_at,
          updated_at,
          template_id,
          summarization_prompts (
            id,
            name,
            description,
            is_default
          )
        `)
        .eq('file_id', fileId)
        .order('created_at', { ascending: false })
        .execute()
    );

    // Format the results to match expected structure
    return (summaries || []).map((summary: any) => ({
      id: summary.id,
      file_id: fileId, // Add the missing file_id field
      content: summary.content,
      model: summary.model,
      prompt: summary.prompt,
      created_at: summary.created_at,
      updated_at: summary.updated_at,
      template_id: summary.template_id,
      template: summary.template_id && summary.summarization_prompts
        ? {
            id: summary.template_id,
            name: summary.summarization_prompts.name,
            description: summary.summarization_prompts.description,
            is_default: summary.summarization_prompts.is_default,
          }
        : null,
    }));
  }

  async create(data: SummarizationCreateData): Promise<Summarization> {
    this.validateRequired(data, 'Create summarization');
    
    return this.executeQuery<Summarization>(
      'Create summarization',
      () => this.db
        .from<Summarization>('summarizations')
        .insert(data)
        .select('*')
        .single()
        .execute()
    );
  }
}
