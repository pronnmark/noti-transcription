import { openRouterService } from './openrouter';
import { notesService } from '@/lib/db/notesService';
import { audioFilesService } from '@/lib/db/sqliteServices';
import type { TranscriptSegment } from '@/lib/db/sqliteSchema';

// Extraction prompts for different note types
const EXTRACTION_PROMPTS = {
  tasks: `Analyze this transcript and extract all tasks, action items, and commitments.
          For each task found, provide:
          - The exact task description
          - Who is responsible (if mentioned)
          - Any deadline or timeline mentioned
          - Priority level (high/medium/low based on context)
          
          Format your response as a JSON array of objects with these fields:
          [{
            "content": "Complete the proposal document",
            "speaker": "John",
            "context": "The surrounding conversation text",
            "priority": "high",
            "metadata": { "deadline": "Friday", "assigned_to": "John" }
          }]`,
  
  questions: `Find all questions that were asked but NOT answered in this conversation.
              For each unanswered question, provide:
              - The exact question
              - Who asked it
              - Why it seems unanswered
              
              Format as JSON array:
              [{
                "content": "What's the budget for Q2?",
                "speaker": "Sarah",
                "context": "Context around the question",
                "metadata": { "topic": "budget", "urgency": "medium" }
              }]`,
  
  decisions: `Identify all key decisions made during this conversation.
              For each decision, provide:
              - What was decided
              - Who made or confirmed the decision
              - Any conditions or dependencies
              
              Format as JSON array:
              [{
                "content": "We will proceed with Option B",
                "speaker": "Manager",
                "context": "After discussing pros and cons...",
                "metadata": { "impact": "high", "effective_date": "immediately" }
              }]`,
  
  followups: `Extract all items that need follow-up or future discussion.
              Include:
              - What needs follow-up
              - Why it needs follow-up
              - Suggested timeline
              
              Format as JSON array:
              [{
                "content": "Review competitor analysis",
                "speaker": "Team",
                "context": "We need more data before deciding",
                "metadata": { "reason": "insufficient data", "timeline": "next week" }
              }]`,
  
  mentions: `Extract important mentions including:
            - People's names and their roles
            - Specific dates, deadlines, or time references
            - Project names, company names, or important references
            - Key metrics or numbers
            
            Format as JSON array:
            [{
              "content": "Client: Acme Corp",
              "speaker": "Sales",
              "context": "Our biggest client Acme Corp...",
              "metadata": { "type": "company", "relationship": "client" }
            }]`
};

interface ExtractedNote {
  content: string;
  speaker?: string;
  context?: string;
  priority?: 'high' | 'medium' | 'low';
  metadata?: any;
}

export async function extractNotesFromTranscript(
  fileId: number,
  transcript: TranscriptSegment[]
): Promise<{ success: boolean; notesCount: number; error?: string }> {
  try {
    console.log(`🤖 Starting notes extraction for file ${fileId}...`);
    
    // Update file status
    await audioFilesService.update(fileId, {
      notesStatus: 'processing'
    });

    // Convert transcript to text with speaker labels and timestamps
    const transcriptText = transcript
      .map((segment: TranscriptSegment) => {
        const timestamp = `[${formatTime(segment.start)}]`;
        const speaker = segment.speaker ? `${segment.speaker}: ` : '';
        return `${timestamp} ${speaker}${segment.text}`;
      })
      .join('\n');

    console.log(`Transcript length: ${transcriptText.length} characters`);

    // Extract notes for each type
    const allNotes: any[] = [];
    const noteTypes: Array<keyof typeof EXTRACTION_PROMPTS> = ['tasks', 'questions', 'decisions', 'followups', 'mentions'];
    
    for (const noteType of noteTypes) {
      console.log(`Extracting ${noteType}...`);
      
      try {
        const prompt = EXTRACTION_PROMPTS[noteType];
        const response = await openRouterService.chat([
          {
            role: 'system',
            content: `You are an AI assistant that extracts structured information from transcripts.
                     Always respond with valid JSON arrays as specified.
                     Be precise and include context.
                     Preserve the original language (Swedish/English) in your extractions.`
          },
          {
            role: 'user',
            content: `${prompt}\n\nTranscript:\n${transcriptText}`
          }
        ], {
          model: 'anthropic/claude-4',
          maxTokens: 2000,
          temperature: 0.3
        });

        // Parse the JSON response
        let extractedNotes: ExtractedNote[] = [];
        try {
          // Clean the response - sometimes the model adds markdown formatting
          const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          extractedNotes = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error(`Failed to parse ${noteType} response:`, parseError);
          console.log('Raw response:', response);
          continue;
        }

        console.log(`Found ${extractedNotes.length} ${noteType}`);

        // Convert to database format
        for (const note of extractedNotes) {
          // Find the timestamp for this note by searching the transcript
          let timestamp: number | undefined;
          if (note.content) {
            // Search for the content in the transcript to find the timestamp
            for (const segment of transcript) {
              if (segment.text.toLowerCase().includes(note.content.toLowerCase().substring(0, 50))) {
                timestamp = segment.start;
                break;
              }
            }
          }

          allNotes.push({
            fileId,
            noteType,
            content: note.content,
            context: note.context,
            speaker: note.speaker,
            timestamp,
            priority: note.priority || 'medium',
            status: 'active',
            metadata: note.metadata ? JSON.stringify(note.metadata) : null
          });
        }
      } catch (error) {
        console.error(`Error extracting ${noteType}:`, error);
      }
    }

    console.log(`Total notes extracted: ${allNotes.length}`);

    // Save all notes to database
    if (allNotes.length > 0) {
      await notesService.createBatch(allNotes);
    }

    // Update file status
    await audioFilesService.update(fileId, {
      notesStatus: 'completed',
      notesExtractedAt: new Date().toISOString()
    });

    // Update notes count
    await notesService.updateFileNotesCount(fileId);

    return {
      success: true,
      notesCount: allNotes.length
    };

  } catch (error) {
    console.error('Notes extraction error:', error);
    
    // Update file status to failed
    await audioFilesService.update(fileId, {
      notesStatus: 'failed',
      lastError: error instanceof Error ? error.message : 'Notes extraction failed'
    });

    return {
      success: false,
      notesCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}