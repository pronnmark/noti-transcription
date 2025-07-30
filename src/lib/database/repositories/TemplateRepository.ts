import { BaseRepository } from './BaseRepository';
import { ITemplateRepository } from '../interfaces/repositories';
import { DatabaseClient } from '../interfaces/DatabaseClient';

export class SummarizationTemplateRepository extends BaseRepository implements ITemplateRepository {
  constructor(db: DatabaseClient) {
    super(db);
  }
  // TODO: Implement Supabase-based summarization template repository methods

  async findActiveByIds(ids: string[]): Promise<any[]> {
    // Stub implementation - returns empty array since table doesn't exist yet
    console.warn(
      'SummarizationTemplateRepository.findActiveByIds called but summarization_templates table not implemented'
    );
    return [];
  }
}
