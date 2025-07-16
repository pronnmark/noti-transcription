import { openRouterService } from './openrouter';
import { db } from '../db/sqlite';
import { psychologicalEvaluations, psychologicalMetrics, audioFiles } from '../db/sqliteSchema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { format } from 'date-fns';
import { createId } from '@paralleldrive/cuid2';
import type { TranscriptSegment, PsychologicalEvaluation, NewPsychologicalEvaluation } from '../db/sqliteSchema';

// Default psychological evaluation prompt
const DEFAULT_PSYCHOLOGY_PROMPT = `Analyze this transcript for comprehensive psychological insights. Focus on emotional state, mood patterns, and mental well-being indicators.

ANALYZE THE FOLLOWING DIMENSIONS:

1. MOOD ANALYSIS (score 0-10 for each):
   - Happy: Joy, contentment, satisfaction
   - Sad: Melancholy, disappointment, grief
   - Anxious: Worry, nervousness, unease
   - Stressed: Pressure, tension, overwhelm
   - Calm: Peaceful, relaxed, composed
   - Excited: Enthusiasm, anticipation, energy
   - Frustrated: Irritation, annoyance, impatience
   - Confident: Self-assured, certain, positive

2. ENERGY LEVEL (1-10 scale):
   - Speech pace and rhythm
   - Vocal energy and enthusiasm
   - Cognitive sharpness and clarity
   - Physical vitality indicators

3. STRESS INDICATORS (1-10 scale):
   - Vocal tension and strain
   - Hesitation and pauses
   - Repetitive patterns
   - Emotional pressure signs

4. CONFIDENCE LEVEL (1-10 scale):
   - Assertiveness in speech
   - Certainty in statements
   - Decision-making clarity
   - Self-assurance indicators

5. ENGAGEMENT LEVEL (1-10 scale):
   - Participation intensity
   - Interest and focus
   - Attention sustainability
   - Interactive responsiveness

6. EMOTIONAL STATE ANALYSIS:
   - Dominant emotion throughout
   - Secondary emotions present
   - Emotional stability (1-10)
   - Emotional intensity (1-10)

7. SPEECH PATTERNS:
   - Pace: slow/normal/fast
   - Tone: positive/negative/neutral
   - Hesitation count (approximate)
   - Interruption patterns
   - Vocal tension level (1-10)

8. TIMESTAMP ANALYSIS:
   - Key emotional moments with timestamps
   - Mood progression throughout recording
   - Energy level changes
   - Critical psychological shifts

9. KEY INSIGHTS:
   - Overall psychological state summary
   - Notable patterns or concerns
   - Strengths and positive indicators
   - Areas needing attention
   - Recommendations for well-being

IMPORTANT RESPONSE FORMAT:
Return a valid JSON object with this exact structure:
{
  "mood": {
    "happy": 7,
    "sad": 2,
    "anxious": 4,
    "stressed": 3,
    "calm": 6,
    "excited": 8,
    "frustrated": 2,
    "confident": 7
  },
  "energy": 8,
  "stress_level": 3,
  "confidence": 7,
  "engagement": 9,
  "emotional_state": {
    "dominant_emotion": "excited",
    "secondary_emotions": ["confident", "happy"],
    "emotional_stability": 7,
    "emotional_intensity": 8
  },
  "speech_patterns": {
    "pace": "fast",
    "tone": "positive",
    "hesitation_count": 3,
    "interruption_count": 1,
    "vocal_tension": 2
  },
  "key_insights": "Individual shows high energy and engagement with positive outlook...",
  "timestamp_analysis": [
    {
      "timestamp": 45.5,
      "mood_score": 8,
      "energy_level": 9,
      "key_emotion": "excited"
    }
  ]
}

TRANSCRIPT TO ANALYZE:`;

export const psychologyService = {
  async evaluateTranscript(
    fileId: number,
    transcript: TranscriptSegment[],
    model: string = 'anthropic/claude-sonnet-4'
  ): Promise<{ success: boolean; evaluation?: PsychologicalEvaluation; error?: string }> {
    try {
      console.log(`🧠 Starting psychological evaluation for file ${fileId}...`);
      
      // Convert transcript to text with timestamps and speakers
      const transcriptText = transcript
        .map((segment: TranscriptSegment) => {
          const timestamp = `[${this.formatTime(segment.start)}]`;
          const speaker = segment.speaker ? `${segment.speaker}: ` : '';
          return `${timestamp} ${speaker}${segment.text}`;
        })
        .join('\n');

      console.log(`Transcript length: ${transcriptText.length} characters`);

      // Get AI analysis
      const response = await openRouterService.chat([
        {
          role: 'system',
          content: `You are a psychological analysis expert specializing in emotional and mental state evaluation from speech transcripts. 
                   CRITICAL: Respond with ONLY valid JSON format. No explanatory text, no markdown formatting, no additional content.
                   Start your response with { and end with }. Ensure all JSON is properly formatted.`
        },
        {
          role: 'user',
          content: `${DEFAULT_PSYCHOLOGY_PROMPT}\n\n${transcriptText}`
        }
      ], {
        model,
        maxTokens: 3000,
        temperature: 0.1
      });

      console.log(`Raw psychology response:`, response.substring(0, 200) + '...');

      // Parse the JSON response
      let analysisData;
      try {
        // Clean the response - remove markdown formatting
        let cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Find the JSON object
        const firstBrace = cleanedResponse.indexOf('{');
        const lastBrace = cleanedResponse.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
          cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
        }
        
        analysisData = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('Failed to parse psychology response:', parseError);
        console.log('Raw response:', response);
        return {
          success: false,
          error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        };
      }

      // Validate and structure the data
      const evaluationData: NewPsychologicalEvaluation = {
        fileId,
        mood: analysisData.mood || {},
        energy: analysisData.energy || 5,
        stressLevel: analysisData.stress_level || 5,
        confidence: analysisData.confidence || 5,
        engagement: analysisData.engagement || 5,
        emotionalState: analysisData.emotional_state || {},
        speechPatterns: analysisData.speech_patterns || {},
        keyInsights: analysisData.key_insights || 'No specific insights available',
        timestampAnalysis: analysisData.timestamp_analysis || [],
        model,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      const [evaluation] = await db.insert(psychologicalEvaluations)
        .values(evaluationData)
        .returning();

      console.log(`✅ Psychological evaluation completed for file ${fileId}`);

      // Update daily metrics
      await this.updateDailyMetrics(evaluation);

      return {
        success: true,
        evaluation
      };

    } catch (error) {
      console.error('Psychology evaluation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async getEvaluationsByFileId(fileId: number): Promise<PsychologicalEvaluation[]> {
    try {
      return await db.select()
        .from(psychologicalEvaluations)
        .where(eq(psychologicalEvaluations.fileId, fileId))
        .orderBy(desc(psychologicalEvaluations.createdAt));
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      return [];
    }
  },

  async getEvaluationsByDateRange(startDate: string, endDate: string): Promise<PsychologicalEvaluation[]> {
    try {
      return await db.select()
        .from(psychologicalEvaluations)
        .where(and(
          gte(psychologicalEvaluations.createdAt, startDate),
          lte(psychologicalEvaluations.createdAt, endDate)
        ))
        .orderBy(desc(psychologicalEvaluations.createdAt));
    } catch (error) {
      console.error('Error fetching evaluations by date range:', error);
      return [];
    }
  },

  async getRecentEvaluations(limit: number = 10): Promise<PsychologicalEvaluation[]> {
    try {
      return await db.select()
        .from(psychologicalEvaluations)
        .orderBy(desc(psychologicalEvaluations.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error fetching recent evaluations:', error);
      return [];
    }
  },

  async getDailyMetrics(date: string): Promise<any> {
    try {
      const [metrics] = await db.select()
        .from(psychologicalMetrics)
        .where(eq(psychologicalMetrics.date, date))
        .limit(1);

      return metrics || null;
    } catch (error) {
      console.error('Error fetching daily metrics:', error);
      return null;
    }
  },

  async getMetricsByDateRange(startDate: string, endDate: string): Promise<any[]> {
    try {
      return await db.select()
        .from(psychologicalMetrics)
        .where(and(
          gte(psychologicalMetrics.date, startDate),
          lte(psychologicalMetrics.date, endDate)
        ))
        .orderBy(desc(psychologicalMetrics.date));
    } catch (error) {
      console.error('Error fetching metrics by date range:', error);
      return [];
    }
  },

  async updateDailyMetrics(evaluation: PsychologicalEvaluation): Promise<void> {
    try {
      const date = format(new Date(evaluation.createdAt), 'yyyy-MM-dd');
      
      // Get all evaluations for this date
      const dayEvaluations = await db.select()
        .from(psychologicalEvaluations)
        .where(and(
          gte(psychologicalEvaluations.createdAt, `${date}T00:00:00.000Z`),
          lte(psychologicalEvaluations.createdAt, `${date}T23:59:59.999Z`)
        ));

      if (dayEvaluations.length === 0) return;

      // Calculate averages
      const totalEnergy = dayEvaluations.reduce((sum, evaluation) => sum + (evaluation.energy || 0), 0);
      const totalStress = dayEvaluations.reduce((sum, evaluation) => sum + (evaluation.stressLevel || 0), 0);
      const sessionCount = dayEvaluations.length;

      // Calculate average mood score (aggregate all mood dimensions)
      let totalMoodScore = 0;
      let moodDimensions = 0;
      
      dayEvaluations.forEach(evaluation => {
        if (evaluation.mood) {
          try {
            const moodData = evaluation.mood;
            Object.values(moodData).forEach(score => {
              if (typeof score === 'number') {
                totalMoodScore += score;
                moodDimensions++;
              }
            });
          } catch (e) {
            console.warn('Failed to parse mood data:', e);
          }
        }
      });

      const averageMood = moodDimensions > 0 ? totalMoodScore / moodDimensions : 0;
      const averageEnergy = totalEnergy / sessionCount;
      const averageStress = totalStress / sessionCount;

      // Determine dominant emotion
      const emotionCounts: Record<string, number> = {};
      dayEvaluations.forEach(evaluation => {
        if (evaluation.emotionalState) {
          try {
            const emotionData = evaluation.emotionalState;
            if (emotionData.dominant_emotion) {
              emotionCounts[emotionData.dominant_emotion] = (emotionCounts[emotionData.dominant_emotion] || 0) + 1;
            }
          } catch (e) {
            console.warn('Failed to parse emotional state:', e);
          }
        }
      });

      const dominantEmotion = Object.entries(emotionCounts).reduce(
        (max, [emotion, count]) => count > max.count ? { emotion, count } : max,
        { emotion: 'neutral', count: 0 }
      ).emotion;

      // Generate insights
      const insights = this.generateDailyInsights(averageMood, averageEnergy, averageStress, dominantEmotion, sessionCount);

      // Upsert daily metrics
      const existingMetrics = await this.getDailyMetrics(date);
      
      if (existingMetrics) {
        await db.update(psychologicalMetrics)
          .set({
            averageMood,
            averageEnergy,
            averageStress,
            sessionCount,
            dominantEmotion,
            insights,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(psychologicalMetrics.id, existingMetrics.id));
      } else {
        await db.insert(psychologicalMetrics)
          .values({
            id: createId(),
            userId: 'default',
            date,
            averageMood,
            averageEnergy,
            averageStress,
            sessionCount,
            dominantEmotion,
            insights,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
      }

    } catch (error) {
      console.error('Error updating daily metrics:', error);
    }
  },

  generateDailyInsights(
    averageMood: number,
    averageEnergy: number,
    averageStress: number,
    dominantEmotion: string,
    sessionCount: number
  ): string {
    const insights = [];

    // Mood insights
    if (averageMood >= 7) {
      insights.push('Positive emotional state maintained throughout the day');
    } else if (averageMood <= 4) {
      insights.push('Lower mood levels detected - consider self-care activities');
    }

    // Energy insights
    if (averageEnergy >= 8) {
      insights.push('High energy levels - great productivity potential');
    } else if (averageEnergy <= 3) {
      insights.push('Low energy detected - rest and recovery may be needed');
    }

    // Stress insights
    if (averageStress >= 7) {
      insights.push('Elevated stress levels - consider stress management techniques');
    } else if (averageStress <= 3) {
      insights.push('Low stress levels - good emotional regulation');
    }

    // Activity insights
    if (sessionCount >= 5) {
      insights.push('High activity day with multiple sessions');
    } else if (sessionCount === 1) {
      insights.push('Single session day - focused interaction');
    }

    // Emotion insights
    if (dominantEmotion === 'excited' || dominantEmotion === 'happy') {
      insights.push('Positive dominant emotion - good mental state');
    } else if (dominantEmotion === 'stressed' || dominantEmotion === 'anxious') {
      insights.push('Challenging emotional state - consider relaxation techniques');
    }

    return insights.join('. ') + '.';
  },

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
};