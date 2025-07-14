import { openRouterService } from './openrouter';
import { notesService } from '@/lib/db/notesService';
import { audioFilesService, settingsService } from '@/lib/db/sqliteServices';
import type { TranscriptSegment } from '@/lib/db/sqliteSchema';

// Default extraction prompts for different note types
const DEFAULT_EXTRACTION_PROMPTS = {
  tasks: `Analyze this transcript and extract all tasks, action items, and commitments mentioned.
          Look for:
          - Explicit tasks ("I need to...", "We should...", "Can you...")
          - Implied actions from decisions
          - Deadlines and time-sensitive items
          - Work assignments and responsibilities
          
          For each task, provide:
          - Clear, actionable description
          - Who is responsible (if mentioned)
          - Any deadline or timeline mentioned
          - Priority level based on urgency and importance
          
          Format your response as a JSON array of objects with these fields:
          [{
            "content": "Complete the proposal document",
            "speaker": "John",
            "context": "The surrounding conversation text",
            "priority": "high",
            "metadata": { "deadline": "Friday", "assigned_to": "John" }
          }]`,
  
  questions: `Find all questions that were asked but NOT fully answered in this conversation.
              Look for:
              - Direct questions that received no response
              - Questions that got partial or unclear answers
              - Questions that were deferred or postponed
              
              For each unanswered question, provide:
              - The exact question as asked
              - Who asked it
              - Brief explanation of why it seems unanswered
              
              Format as JSON array:
              [{
                "content": "What's the budget for Q2?",
                "speaker": "Sarah",
                "context": "Context around the question",
                "metadata": { "topic": "budget", "urgency": "medium" }
              }]`,
  
  decisions: `Identify all key decisions made during this conversation.
              Look for:
              - Explicit decisions ("We've decided to...", "Let's go with...")
              - Consensus agreements
              - Choices between options
              - Policy or process changes
              
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
              Look for:
              - Items marked for "next time"
              - Unresolved issues
              - Information that needs to be gathered
              - People who need to be contacted
              
              Include:
              - What needs follow-up
              - Why it needs follow-up
              - Suggested timeline if mentioned
              
              Format as JSON array:
              [{
                "content": "Review competitor analysis",
                "speaker": "Team",
                "context": "We need more data before deciding",
                "metadata": { "reason": "insufficient data", "timeline": "next week" }
              }]`,
  
  mentions: `Extract important mentions and references including:
            - People's names and their roles/titles
            - Specific dates, deadlines, or time references
            - Project names, company names, or important references
            - Key metrics, numbers, or financial figures
            - Tools, software, or technical references
            
            Format as JSON array:
            [{
              "content": "Client: Acme Corp",
              "speaker": "Sales",
              "context": "Our biggest client Acme Corp...",
              "metadata": { "type": "company", "relationship": "client" }
            }]`
};

// Function to get extraction prompts (either from settings or defaults)
async function getExtractionPrompts() {
  try {
    const settings = await settingsService.get();
    return {
      tasks: settings?.notesPrompts?.tasks || DEFAULT_EXTRACTION_PROMPTS.tasks,
      questions: settings?.notesPrompts?.questions || DEFAULT_EXTRACTION_PROMPTS.questions,
      decisions: settings?.notesPrompts?.decisions || DEFAULT_EXTRACTION_PROMPTS.decisions,
      followups: settings?.notesPrompts?.followups || DEFAULT_EXTRACTION_PROMPTS.followups,
      mentions: settings?.notesPrompts?.mentions || DEFAULT_EXTRACTION_PROMPTS.mentions,
    };
  } catch (error) {
    console.log('Could not load custom prompts, using defaults');
    return DEFAULT_EXTRACTION_PROMPTS;
  }
}

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

    // Get model from settings
    let model = 'anthropic/claude-sonnet-4';
    try {
      const settings = await settingsService.get();
      if (settings?.ai?.aiExtractModel) {
        model = settings.ai.aiExtractModel;
      }
    } catch (error) {
      console.log('Could not load settings, using default model');
    }
    console.log(`Using model: ${model}`);

    // Get extraction prompts (from settings or defaults)
    const extractionPrompts = await getExtractionPrompts();
    
    // Extract notes for each type
    const allNotes: any[] = [];
    const noteTypes: Array<keyof typeof extractionPrompts> = ['tasks', 'questions', 'decisions', 'followups', 'mentions'];
    
    // Map plural form (used in prompts) to singular form (used in database)
    const noteTypeMapping: Record<string, string> = {
      'tasks': 'task',
      'questions': 'question', 
      'decisions': 'decision',
      'followups': 'followup',
      'mentions': 'mention'
    };
    
    for (const noteType of noteTypes) {
      console.log(`Extracting ${noteType}...`);
      
      try {
        const prompt = extractionPrompts[noteType];
        const response = await openRouterService.chat([
          {
            role: 'system',
            content: `You are an AI assistant that extracts structured information from transcripts.
                     CRITICAL: Respond with ONLY a valid JSON array. Do NOT include any explanatory text, markdown formatting, or other content.
                     Start your response with [ and end with ].
                     Be precise and include context.
                     Preserve the original language (Swedish/English) in your extractions.`
          },
          {
            role: 'user',
            content: `${prompt}\n\nTranscript:\n${transcriptText}`
          }
        ], {
          model,
          maxTokens: 2000,
          temperature: 0.3
        });

        // Parse the JSON response
        let extractedNotes: ExtractedNote[] = [];
        try {
          // Clean the response - sometimes the model adds markdown formatting and explanatory text
          let cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          
          // Find the JSON array - look for the first [ and last ]
          const firstBracket = cleanedResponse.indexOf('[');
          const lastBracket = cleanedResponse.lastIndexOf(']');
          
          if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
            cleanedResponse = cleanedResponse.substring(firstBracket, lastBracket + 1);
          }
          
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
            noteType: noteTypeMapping[noteType], // Use singular form for database
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