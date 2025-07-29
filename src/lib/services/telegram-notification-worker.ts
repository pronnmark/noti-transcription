import { db } from '@/lib/database';
import {
  transcriptionJobs,
  telegramNotificationPreferences,
  audioFiles,
} from '@/lib/database/schema';
import { eq, and, isNotNull, gte, desc } from 'drizzle-orm';

// Check if we should send a notification based on user preferences and quiet hours
function shouldSendNotification(
  preferences: any,
  notificationType:
    | 'transcriptionComplete'
    | 'transcriptionFailed'
    | 'summaryReady',
): boolean {
  // Check if this notification type is enabled
  if (!preferences[notificationType]) {
    return false;
  }

  // Check quiet hours
  if (preferences.quietHoursStart && preferences.quietHoursEnd) {
    const now = new Date();
    const timezone = preferences.timezone || 'UTC';

    // Convert to user's timezone (simplified - in production use a proper timezone library)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = preferences.quietHoursStart
      .split(':')
      .map(Number);
    const [endHour, endMinute] = preferences.quietHoursEnd
      .split(':')
      .map(Number);

    const quietStart = startHour * 60 + startMinute;
    const quietEnd = endHour * 60 + endMinute;

    // Handle overnight quiet hours
    if (quietStart > quietEnd) {
      // Quiet hours span midnight
      if (currentTime >= quietStart || currentTime < quietEnd) {
        return false; // In quiet hours
      }
    } else {
      // Normal quiet hours
      if (currentTime >= quietStart && currentTime < quietEnd) {
        return false; // In quiet hours
      }
    }
  }

  return true;
}

// Send notification for completed transcription
export async function notifyTranscriptionComplete(jobId: number) {
  try {
    // Get job details
    const jobResults = await db
      .select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.id, jobId))
      .limit(1);
    const job = jobResults[0];

    if (!job) {
      return;
    }

    // Get file details
    const fileResults = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, job.fileId))
      .limit(1);
    const file = fileResults[0];

    if (!file) {
      return;
    }

    // For now, skip telegram notifications since we don't have chatId stored in the schema
    // TODO: Add telegram metadata storage to jobs or files
    return;
  } catch (error) {
    console.error('Error in notifyTranscriptionComplete:', error);
  }
}

// Send notification for failed transcription
export async function notifyTranscriptionFailed(jobId: number) {
  try {
    // Get job details
    const jobResults = await db
      .select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.id, jobId))
      .limit(1);
    const job = jobResults[0];

    if (!job) {
      return;
    }

    // Get file details
    const fileResults = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, job.fileId))
      .limit(1);
    const file = fileResults[0];

    if (!file) {
      return;
    }

    // For now, skip telegram notifications since we don't have chatId stored in the schema
    // TODO: Add telegram metadata storage to jobs or files
    return;
  } catch (error) {
    console.error('Error in notifyTranscriptionFailed:', error);
  }
}

// Monitor transcription jobs and send notifications
export async function monitorTranscriptionJobs() {
  try {
    // Find recently completed jobs that haven't been notified
    const recentJobs = await db
      .select()
      .from(transcriptionJobs)
      .where(
        and(
          eq(transcriptionJobs.status, 'completed'),
          isNotNull(transcriptionJobs.completedAt),
          gte(
            transcriptionJobs.completedAt,
            new Date(Date.now() - 5 * 60 * 1000),
          ), // Last 5 minutes
        ),
      );

    // Check each job for Telegram metadata
    // TODO: Re-enable when telegram metadata storage is implemented in schema
    for (const job of recentJobs) {
      // Skip notifications until metadata field is added to schema
      // if (job.metadata?.telegramChatId && !job.metadata?.notified) {
      //   await notifyTranscriptionComplete(job.id);
      // }
    }

    // Find recently failed jobs
    const failedJobs = await db
      .select()
      .from(transcriptionJobs)
      .where(
        and(
          eq(transcriptionJobs.status, 'failed'),
          isNotNull(transcriptionJobs.completedAt),
          gte(
            transcriptionJobs.completedAt,
            new Date(Date.now() - 5 * 60 * 1000),
          ), // Last 5 minutes
        ),
      );

    // Notify for failed jobs
    // TODO: Re-enable when telegram metadata storage is implemented in schema
    for (const job of failedJobs) {
      // Skip notifications until metadata field is added to schema
      // if (job.metadata?.telegramChatId && !job.metadata?.notifiedFailure) {
      //   await notifyTranscriptionFailed(job.id);
      // }
    }
  } catch (error) {
    console.error('Error monitoring transcription jobs:', error);
  }
}

// Start monitoring (call this from your worker or cron job)
export function startNotificationMonitoring(intervalMs: number = 30000) {
  // Run immediately
  monitorTranscriptionJobs();

  // Then run periodically
  return setInterval(() => {
    monitorTranscriptionJobs();
  }, intervalMs);
}
