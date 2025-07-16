import { openRouterService } from './openrouter';
import { notesService } from '@/lib/db/notesService';
import { audioFilesService, settingsService } from '@/lib/db/sqliteServices';
import type { TranscriptSegment } from '@/lib/db/sqliteSchema';

// Default extraction prompts for different note types
const DEFAULT_EXTRACTION_PROMPTS = {
  tasks: `Extract ONLY concrete, actionable tasks and commitments from this transcript.
          
          STRICT CRITERIA - Only include if it meets ALL of these:
          - Specific action to be taken by someone
          - Clear responsibility (who will do it)
          - Not vague statements or general discussion
          - Represents actual work or commitment
          
          INCLUDE examples:
          - "I'll send the report by Friday"
          - "We need to call the client tomorrow"
          - "Can you schedule the meeting?"
          - "I'll follow up with the team"
          
          EXCLUDE examples:
          - General opinions or thoughts
          - Questions without commitment
          - Casual mentions without action
          - Vague "we should" without specific assignment
          
          Format your response as a JSON array of objects with these fields:
          [{
            "content": "Send the quarterly report to the client",
            "speaker": "John",
            "context": "Brief surrounding conversation",
            "priority": "high",
            "metadata": { "deadline": "Friday", "assigned_to": "John" }
          }]`,
  
  questions: `Extract ONLY genuine unanswered questions that require follow-up.
              
              STRICT CRITERIA - Only include if it meets ALL of these:
              - Direct question with clear intent
              - No complete answer was provided
              - Important enough to need follow-up
              - Not rhetorical or casual questions
              
              INCLUDE examples:
              - "What's the budget for this project?" (no answer given)
              - "When is the deadline?" (answered vaguely or deferred)
              - "Who will handle the client meeting?" (no clear assignment)
              
              EXCLUDE examples:
              - Rhetorical questions ("How about that?")
              - Questions that were answered clearly
              - Casual conversational questions
              - Questions answered later in the conversation
              
              Format as JSON array:
              [{
                "content": "What's the budget for Q2?",
                "speaker": "Sarah",
                "context": "Brief context where question was asked",
                "metadata": { "topic": "budget", "urgency": "medium" }
              }]`,
  
  decisions: `Extract ONLY concrete decisions that were actually made and agreed upon.
              
              STRICT CRITERIA - Only include if it meets ALL of these:
              - Clear decision or choice was made
              - Specific outcome or direction chosen
              - Not just suggestions or considerations
              - Represents actual agreement or commitment
              
              INCLUDE examples:
              - "We've decided to go with vendor A"
              - "Let's proceed with the new pricing model"
              - "We agreed to postpone the launch until next month"
              - "The team will use the new process starting Monday"
              
              EXCLUDE examples:
              - Suggestions or ideas ("Maybe we should...")
              - Considerations ("We could look into...")
              - Discussions without clear resolution
              - Tentative statements without commitment
              
              Format as JSON array:
              [{
                "content": "We will proceed with Option B for the new product launch",
                "speaker": "Manager",
                "context": "After discussing pros and cons of both options",
                "metadata": { "impact": "high", "effective_date": "immediately" }
              }]`,
  
  followups: `Extract ONLY items that explicitly need future action or discussion.
              
              STRICT CRITERIA - Only include if it meets ALL of these:
              - Specific item requiring future attention
              - Clear indication it needs follow-up
              - Not just general discussion topics
              - Represents actual work or communication needed
              
              INCLUDE examples:
              - "Let's revisit this in next week's meeting"
              - "I need to get back to you on that"
              - "We should follow up with the client after the presentation"
              - "This needs more research before we decide"
              
              EXCLUDE examples:
              - General topics mentioned in passing
              - Completed items
              - Vague suggestions without clear need
              - Items that were already resolved
              
              Format as JSON array:
              [{
                "content": "Review competitor analysis before final decision",
                "speaker": "Team",
                "context": "We need more data before deciding on pricing",
                "metadata": { "reason": "insufficient data", "timeline": "next week" }
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
): Promise<{ success: boolean; notesCount: number; error?: string; debugInfo?: any }> {
  // Initialize debug info outside try block so it's available in catch
  let debugInfo: any = {};
  
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
      if (settings?.aiExtractModel) {
        model = settings.aiExtractModel;
      }
    } catch (error) {
      console.log('Could not load settings, using default model');
    }
    console.log(`Using model: ${model}`);

    // Get extraction prompts (from settings or defaults)
    const extractionPrompts = await getExtractionPrompts();
    
    // Extract notes for each type
    const allNotes: any[] = [];
    const noteTypes: Array<keyof typeof extractionPrompts> = ['tasks', 'questions', 'decisions', 'followups'];
    
    // Map plural form (used in prompts) to singular form (used in database)
    const noteTypeMapping: Record<string, string> = {
      'tasks': 'task',
      'questions': 'question', 
      'decisions': 'decision',
      'followups': 'followup'
    };
    
    for (const noteType of noteTypes) {
      console.log(`Extracting ${noteType}...`);
      
      try {
        const prompt = extractionPrompts[noteType];
        const response = await openRouterService.chat([
          {
            role: 'system',
            content: `You are an AI assistant that extracts structured information from transcripts.
                     CRITICAL RESPONSE FORMAT:
                     - Respond with ONLY a valid JSON array
                     - Do NOT include any explanatory text, markdown formatting, or other content
                     - Start your response with [ and end with ]
                     - Each object in the array must be valid JSON
                     - Be precise and include context
                     - Preserve the original language (Swedish/English) in your extractions
                     - If no items are found, return an empty array: []`
          },
          {
            role: 'user',
            content: `${prompt}
            
IMPORTANT: Your response must be valid JSON format. Return only a JSON array of objects, nothing else.

Transcript:
${transcriptText}`
          }
        ], {
          model,
          maxTokens: 2000,
          temperature: 0.1  // Lower temperature for more consistent JSON output
        });

        // Store raw response for debugging
        console.log(`Raw ${noteType} response:`, response);
        
        // Initialize debug info for this note type
        debugInfo[noteType] = {
          rawResponse: response,
          cleanedResponse: '',
          parseError: null,
          extractedCount: 0
        };
        
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
          
          console.log(`Cleaned ${noteType} response:`, cleanedResponse);
          debugInfo[noteType].cleanedResponse = cleanedResponse;
          
          extractedNotes = JSON.parse(cleanedResponse);
          debugInfo[noteType].extractedCount = extractedNotes.length;
        } catch (parseError) {
          console.error(`Failed to parse ${noteType} response:`, parseError);
          debugInfo[noteType].parseError = parseError instanceof Error ? parseError.message : String(parseError);
          console.log('Raw response:', response);
          console.log('Cleaned response:', debugInfo[noteType].cleanedResponse);
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
      notesCount: allNotes.length,
      debugInfo
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
      error: error instanceof Error ? error.message : 'Unknown error',
      debugInfo: debugInfo || {}
    };
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}