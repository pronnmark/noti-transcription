import { BaseRepository } from './BaseRepository';
import { ITemplateRepository } from '../interfaces/repositories';
import { DatabaseClient } from '../interfaces/DatabaseClient';

export class SummarizationTemplateRepository extends BaseRepository implements ITemplateRepository {
  constructor(db: DatabaseClient) {
    super(db);
  }

  async findById(id: string): Promise<any | null> {
    this.validateRequired(id, 'Find summarization prompt by ID');
    
    return this.executeQueryWithNull<any>(
      'Find summarization prompt by ID',
      () => this.db
        .from('summarization_prompts')
        .select('*')
        .eq('id', id)
        .single()
        .execute()
    );
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

  async findAll(): Promise<any[]> {
    return this.executeQuery<any[]>(
      'Find all summarization prompts',
      () => this.db
        .from('summarization_prompts')
        .select('*')
        .order('name', { ascending: true })
        .execute()
    );
  }

  async findDefault(): Promise<any | null> {
    return this.executeQueryWithNull<any>(
      'Find default summarization prompt',
      () => this.db
        .from('summarization_prompts')
        .select('*')
        .eq('is_default', true)
        .single()
        .execute()
    );
  }
}
