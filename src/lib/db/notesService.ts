import { db } from './sqlite';
import { aiNotes, audioFiles } from './sqliteSchema';
import { eq, and, desc } from 'drizzle-orm';
import type { AINote, NewAINote } from './sqliteSchema';
import { createId } from '@paralleldrive/cuid2';

export const notesService = {
  async create(note: Omit<NewAINote, 'id' | 'createdAt' | 'updatedAt'>): Promise<AINote> {
    try {
      const [created] = await db.insert(aiNotes).values({
        id: createId(),
        ...note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).returning();
      
      return created;
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  },

  async createBatch(notes: Omit<NewAINote, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<AINote[]> {
    try {
      if (notes.length === 0) return [];
      
      const notesToInsert = notes.map(note => ({
        id: createId(),
        ...note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      
      const created = await db.insert(aiNotes).values(notesToInsert).returning();
      
      // Update notes count on the audio file
      if (notes.length > 0 && notes[0].fileId) {
        await this.updateFileNotesCount(notes[0].fileId);
      }
      
      return created;
    } catch (error) {
      console.error('Error creating batch notes:', error);
      throw error;
    }
  },

  async findByFileId(fileId: number): Promise<AINote[]> {
    try {
      return await db.select()
        .from(aiNotes)
        .where(eq(aiNotes.fileId, fileId))
        .orderBy(desc(aiNotes.timestamp), desc(aiNotes.createdAt));
    } catch (error) {
      console.error('Error finding notes by file ID:', error);
      return [];
    }
  },

  async findByFileIdAndType(fileId: number, noteType: string): Promise<AINote[]> {
    try {
      return await db.select()
        .from(aiNotes)
        .where(and(
          eq(aiNotes.fileId, fileId),
          eq(aiNotes.noteType, noteType as any)
        ))
        .orderBy(desc(aiNotes.timestamp));
    } catch (error) {
      console.error('Error finding notes by file ID and type:', error);
      return [];
    }
  },

  async update(id: string, updates: Partial<AINote>): Promise<AINote | null> {
    try {
      const [updated] = await db.update(aiNotes)
        .set({
          ...updates,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(aiNotes.id, id))
        .returning();
      
      return updated || null;
    } catch (error) {
      console.error('Error updating note:', error);
      return null;
    }
  },

  async updateStatus(id: string, status: 'active' | 'completed' | 'archived'): Promise<boolean> {
    try {
      const result = await db.update(aiNotes)
        .set({ 
          status,
          updatedAt: new Date().toISOString()
        })
        .where(eq(aiNotes.id, id));
      
      return true;
    } catch (error) {
      console.error('Error updating note status:', error);
      return false;
    }
  },

  async toggleStatus(id: string, status: 'active' | 'completed' | 'archived'): Promise<boolean> {
    try {
      const updateData: any = { 
        status,
        updatedAt: new Date().toISOString()
      };
      
      // Set completedAt timestamp when marking as completed
      if (status === 'completed') {
        updateData.completedAt = new Date().toISOString();
      } else if (status === 'active') {
        updateData.completedAt = null;
      }

      const result = await db.update(aiNotes)
        .set(updateData)
        .where(eq(aiNotes.id, id));
      
      return true;
    } catch (error) {
      console.error('Error toggling note status:', error);
      return false;
    }
  },

  async addComment(id: string, comment: string): Promise<boolean> {
    try {
      const result = await db.update(aiNotes)
        .set({ 
          comments: comment,
          updatedAt: new Date().toISOString()
        })
        .where(eq(aiNotes.id, id));
      
      return true;
    } catch (error) {
      console.error('Error adding comment:', error);
      return false;
    }
  },

  async updateComment(id: string, comment: string): Promise<boolean> {
    try {
      const result = await db.update(aiNotes)
        .set({ 
          comments: comment,
          updatedAt: new Date().toISOString()
        })
        .where(eq(aiNotes.id, id));
      
      return true;
    } catch (error) {
      console.error('Error updating comment:', error);
      return false;
    }
  },

  async getStats(fileId: number): Promise<any> {
    try {
      const notes = await this.findByFileId(fileId);
      
      const stats = {
        total: notes.length,
        byType: {
          task: notes.filter(n => n.noteType === 'task').length,
          question: notes.filter(n => n.noteType === 'question').length,
          decision: notes.filter(n => n.noteType === 'decision').length,
          followup: notes.filter(n => n.noteType === 'followup').length,
          mention: notes.filter(n => n.noteType === 'mention').length,
        },
        byStatus: {
          active: notes.filter(n => n.status === 'active').length,
          completed: notes.filter(n => n.status === 'completed').length,
          archived: notes.filter(n => n.status === 'archived').length,
        },
        completion: {
          tasks: {
            total: notes.filter(n => n.noteType === 'task').length,
            completed: notes.filter(n => n.noteType === 'task' && n.status === 'completed').length,
          },
          questions: {
            total: notes.filter(n => n.noteType === 'question').length,
            completed: notes.filter(n => n.noteType === 'question' && n.status === 'completed').length,
          }
        }
      };

      return stats;
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      await db.delete(aiNotes).where(eq(aiNotes.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      return false;
    }
  },

  async updateFileNotesCount(fileId: number): Promise<void> {
    try {
      // Get counts by type
      const notes = await this.findByFileId(fileId);
      
      const counts = {
        tasks: notes.filter(n => n.noteType === 'task').length,
        questions: notes.filter(n => n.noteType === 'question').length,
        decisions: notes.filter(n => n.noteType === 'decision').length,
        followups: notes.filter(n => n.noteType === 'followup').length,
        mentions: notes.filter(n => n.noteType === 'mention').length,
      };
      
      // Update the audio file
      await db.update(audioFiles)
        .set({
          notesCount: JSON.stringify(counts),
          updatedAt: new Date(),
        })
        .where(eq(audioFiles.id, fileId));
        
    } catch (error) {
      console.error('Error updating file notes count:', error);
    }
  },

  async extractFromTranscript(fileId: number): Promise<{ success: boolean; count: number }> {
    try {
      // Update file status to processing
      await db.update(audioFiles)
        .set({
          notesStatus: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(audioFiles.id, fileId));
      
      // This would be called from the API route that handles the actual extraction
      // The extraction logic is in the API route
      
      return { success: true, count: 0 };
    } catch (error) {
      console.error('Error extracting notes:', error);
      
      // Update status to failed
      await db.update(audioFiles)
        .set({
          notesStatus: 'failed',
          lastError: error instanceof Error ? error.message : 'Notes extraction failed',
          updatedAt: new Date(),
        })
        .where(eq(audioFiles.id, fileId));
      
      return { success: false, count: 0 };
    }
  },

  // Global task management methods
  async getAllTasks(): Promise<AINote[]> {
    try {
      return await db.select()
        .from(aiNotes)
        .where(eq(aiNotes.noteType, 'task'))
        .orderBy(desc(aiNotes.createdAt));
    } catch (error) {
      console.error('Error getting all tasks:', error);
      return [];
    }
  },

  async getTasksByStatus(status: 'active' | 'completed' | 'archived'): Promise<AINote[]> {
    try {
      return await db.select()
        .from(aiNotes)
        .where(and(
          eq(aiNotes.noteType, 'task'),
          eq(aiNotes.status, status)
        ))
        .orderBy(desc(aiNotes.createdAt));
    } catch (error) {
      console.error('Error getting tasks by status:', error);
      return [];
    }
  },

  async getTasksWithFileInfo(): Promise<(AINote & { fileName?: string | null })[]> {
    try {
      const tasks = await db.select({
        id: aiNotes.id,
        fileId: aiNotes.fileId,
        noteType: aiNotes.noteType,
        content: aiNotes.content,
        context: aiNotes.context,
        speaker: aiNotes.speaker,
        timestamp: aiNotes.timestamp,
        priority: aiNotes.priority,
        status: aiNotes.status,
        metadata: aiNotes.metadata,
        comments: aiNotes.comments,
        completedAt: aiNotes.completedAt,
        assignedTo: aiNotes.assignedTo,
        createdAt: aiNotes.createdAt,
        updatedAt: aiNotes.updatedAt,
        fileName: audioFiles.originalFileName,
      })
        .from(aiNotes)
        .leftJoin(audioFiles, eq(aiNotes.fileId, audioFiles.id))
        .where(eq(aiNotes.noteType, 'task'))
        .orderBy(desc(aiNotes.createdAt));

      return tasks;
    } catch (error) {
      console.error('Error getting tasks with file info:', error);
      return [];
    }
  },

  async getGlobalStats(): Promise<any> {
    try {
      const allNotes = await db.select().from(aiNotes);
      
      const stats = {
        total: allNotes.length,
        byType: {
          task: allNotes.filter(n => n.noteType === 'task').length,
          question: allNotes.filter(n => n.noteType === 'question').length,
          decision: allNotes.filter(n => n.noteType === 'decision').length,
          followup: allNotes.filter(n => n.noteType === 'followup').length,
          mention: allNotes.filter(n => n.noteType === 'mention').length,
        },
        byStatus: {
          active: allNotes.filter(n => n.status === 'active').length,
          completed: allNotes.filter(n => n.status === 'completed').length,
          archived: allNotes.filter(n => n.status === 'archived').length,
        },
        tasks: {
          total: allNotes.filter(n => n.noteType === 'task').length,
          active: allNotes.filter(n => n.noteType === 'task' && n.status === 'active').length,
          completed: allNotes.filter(n => n.noteType === 'task' && n.status === 'completed').length,
        }
      };

      return stats;
    } catch (error) {
      console.error('Error getting global stats:', error);
      return null;
    }
  }
};