import { customAIService } from './customAI';
import type { TranscriptSegment } from '../database/schema';

interface SpeakerMapping {
  [speakerId: string]: string | null;
}

/**
 * Smart sampling: Get optimal number of segments for name detection
 */
function getSampleSegments(transcript: TranscriptSegment[]): TranscriptSegment[] {
  const percentage = 25; // First 25% of transcript
  const minSegments = 5;  // Always get at least 5 segments
  const maxSegments = 30; // Cap at 30 segments for efficiency

  const targetCount = Math.max(
    minSegments,
    Math.min(maxSegments, Math.floor(transcript.length * percentage / 100)),
  );

  return transcript.slice(0, targetCount);
}

/**
 * Detect speaker names from transcript introductions using LLM
 */
export async function detectSpeakerNames(
  transcript: TranscriptSegment[],
): Promise<{ success: boolean; mappings?: SpeakerMapping; error?: string }> {
  try {
    console.log(`🎯 Starting speaker name detection for ${transcript.length} segments...`);

    if (!transcript || transcript.length === 0) {
      return { success: false, error: 'No transcript segments provided' };
    }

    // Get smart sample of segments
    const sampleSegments = getSampleSegments(transcript);
    const samplePercentage = Math.round((sampleSegments.length / transcript.length) * 100);

    console.log(`📊 Analyzing ${sampleSegments.length} segments (${samplePercentage}%) for name detection`);

    // Convert segments to text format for LLM
    const transcriptText = sampleSegments
      .map((segment) => {
        const timestamp = `[${formatTime(segment.start)}]`;
        const speaker = segment.speaker || 'SPEAKER';
        return `${timestamp} ${speaker}: ${segment.text}`;
      })
      .join('\n');

    console.log(`📝 Sample transcript length: ${transcriptText.length} characters`);

    // Prepare LLM prompt for name detection
    const prompt = `Analyze this transcript sample and identify when speakers introduce themselves with their real names.

Look for introduction patterns like:
- "Philip here" or "Philip speaking"
- "This is Sarah" or "I'm Sarah"  
- "Det här är Philip" or "Jag heter Sarah" (Swedish)
- "My name is John" or similar introductions

Return a JSON object mapping speaker IDs to their real names. Use null if no name is detected for a speaker.

Example format:
{
  "SPEAKER_00": "Philip",
  "SPEAKER_01": null,
  "SPEAKER_02": "Sarah"
}

Important: Only return the JSON object, nothing else.

Transcript sample:
${transcriptText}`;

    // Call LLM for name detection
    console.log(`🤖 Sending sample to LLM for name detection...`);
    const response = await customAIService.generateText(prompt, {
      model: 'claude-sonnet-4-20250514',
      temperature: 0.1,
      maxTokens: 500,
      systemPrompt: 'You are an expert at identifying speaker names from transcript introductions. Return only valid JSON.',
    });

    console.log(`📥 LLM response received:`, response.substring(0, 200) + '...');

    // Parse JSON response
    let mappings: SpeakerMapping;
    try {
      // Clean response and extract JSON
      const cleanResponse = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      mappings = JSON.parse(jsonMatch[0]);
      console.log(`✅ Parsed speaker mappings:`, mappings);

    } catch (parseError) {
      console.error('❌ Failed to parse LLM response:', parseError);
      return {
        success: false,
        error: `Failed to parse name detection response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      };
    }

    // Validate mappings format
    if (typeof mappings !== 'object' || mappings === null) {
      return { success: false, error: 'Invalid mappings format - expected object' };
    }

    // Count detected names
    const detectedNames = Object.entries(mappings).filter(([_, name]) => name !== null);
    console.log(`🎉 Speaker detection completed: ${detectedNames.length} names detected`);

    if (detectedNames.length > 0) {
      detectedNames.forEach(([speakerId, name]) => {
        console.log(`  ${speakerId} → ${name}`);
      });
    } else {
      console.log(`ℹ️  No speaker names detected in sample`);
    }

    return { success: true, mappings };

  } catch (error) {
    console.error('❌ Speaker name detection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during speaker detection',
    };
  }
}

/**
 * Apply speaker name mappings to transcript segments
 */
export function applySpeakerNames(
  transcript: TranscriptSegment[],
  mappings: SpeakerMapping,
): TranscriptSegment[] {
  console.log(`🔄 Applying speaker names to ${transcript.length} segments...`);

  let updatedCount = 0;

  const updatedTranscript = transcript.map((segment) => {
    const originalSpeaker = segment.speaker;
    const newName = originalSpeaker ? mappings[originalSpeaker] : null;

    if (newName && newName !== originalSpeaker) {
      updatedCount++;
      return {
        ...segment,
        speaker: newName,
      };
    }

    return segment;
  });

  console.log(`✅ Applied names to ${updatedCount} segments`);
  return updatedTranscript;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Complete speaker detection and application pipeline
 */
export async function detectAndApplySpeakerNames(
  transcript: TranscriptSegment[],
): Promise<{ success: boolean; updatedTranscript?: TranscriptSegment[]; error?: string; stats?: any }> {
  try {
    // Step 1: Detect names
    const detectionResult = await detectSpeakerNames(transcript);

    if (!detectionResult.success || !detectionResult.mappings) {
      return {
        success: false,
        error: detectionResult.error || 'Name detection failed',
      };
    }

    // Step 2: Apply names to transcript
    const updatedTranscript = applySpeakerNames(transcript, detectionResult.mappings);

    // Generate stats
    const detectedNames = Object.entries(detectionResult.mappings).filter(([_, name]) => name !== null);
    const stats = {
      totalSegments: transcript.length,
      detectedNames: detectedNames.length,
      namesFound: detectedNames.map(([speakerId, name]) => ({ speakerId, name })),
    };

    return {
      success: true,
      updatedTranscript,
      stats,
    };

  } catch (error) {
    console.error('❌ Speaker detection pipeline error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown pipeline error',
    };
  }
}
