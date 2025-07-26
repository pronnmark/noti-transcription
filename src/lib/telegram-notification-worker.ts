import { db } from '@/lib/database';
import { transcriptionJobs, telegramNotificationPreferences } from '@/lib/database/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

// Check if we should send a notification based on user preferences and quiet hours
function shouldSendNotification(
  preferences: any,
  notificationType: 'transcriptionComplete' | 'transcriptionFailed' | 'summaryReady'
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

    const [startHour, startMinute] = preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMinute] = preferences.quietHoursEnd.split(':').map(Number);
    
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
    const job = await db.query.transcriptionJobs.findFirst({
      where: (jobs, { eq }) => eq(jobs.id, jobId),
      with: {
        file: true,
      },
    });

    if (!job || !job.metadata?.telegramChatId) {
      return;
    }

    const chatId = String(job.metadata.telegramChatId);

    // Check notification preferences
    const preferences = await db.query.telegramNotificationPreferences.findFirst({
      where: (prefs, { eq }) => eq(prefs.chatId, chatId),
    });

    // Use default preferences if none exist
    const shouldNotify = preferences 
      ? shouldSendNotification(preferences, 'transcriptionComplete')
      : true; // Default to sending notifications

    if (!shouldNotify) {
      console.log(`Skipping notification for job ${jobId} due to user preferences`);
      return;
    }

    // Send notification via API
    const response = await fetch('/api/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'transcription_complete',
        jobId,
        chatId,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send transcription complete notification:', await response.text());
    }
  } catch (error) {
    console.error('Error in notifyTranscriptionComplete:', error);
  }
}

// Send notification for failed transcription
export async function notifyTranscriptionFailed(jobId: number) {
  try {
    // Get job details
    const job = await db.query.transcriptionJobs.findFirst({
      where: (jobs, { eq }) => eq(jobs.id, jobId),
      with: {
        file: true,
      },
    });

    if (!job || !job.metadata?.telegramChatId) {
      return;
    }

    const chatId = String(job.metadata.telegramChatId);

    // Check notification preferences
    const preferences = await db.query.telegramNotificationPreferences.findFirst({
      where: (prefs, { eq }) => eq(prefs.chatId, chatId),
    });

    // Use default preferences if none exist
    const shouldNotify = preferences 
      ? shouldSendNotification(preferences, 'transcriptionFailed')
      : true; // Default to sending notifications

    if (!shouldNotify) {
      console.log(`Skipping failure notification for job ${jobId} due to user preferences`);
      return;
    }

    // Send notification via API
    const response = await fetch('/api/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'transcription_failed',
        jobId,
        chatId,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send transcription failed notification:', await response.text());
    }
  } catch (error) {
    console.error('Error in notifyTranscriptionFailed:', error);
  }
}

// Monitor transcription jobs and send notifications
export async function monitorTranscriptionJobs() {
  try {
    // Find recently completed jobs that haven't been notified
    const recentJobs = await db.query.transcriptionJobs.findMany({
      where: (jobs, { and, eq, gte, isNotNull }) => and(
        eq(jobs.status, 'completed'),
        isNotNull(jobs.completedAt),
        gte(jobs.completedAt, new Date(Date.now() - 5 * 60 * 1000)), // Last 5 minutes
      ),
      with: {
        file: true,
      },
    });

    // Check each job for Telegram metadata
    for (const job of recentJobs) {
      if (job.metadata?.telegramChatId && !job.metadata?.notified) {
        await notifyTranscriptionComplete(job.id);
        
        // Mark as notified
        await db.update(transcriptionJobs)
          .set({
            metadata: {
              ...job.metadata,
              notified: true,
            },
          })
          .where(eq(transcriptionJobs.id, job.id));
      }
    }

    // Find recently failed jobs
    const failedJobs = await db.query.transcriptionJobs.findMany({
      where: (jobs, { and, eq, gte, isNotNull }) => and(
        eq(jobs.status, 'failed'),
        isNotNull(jobs.completedAt),
        gte(jobs.completedAt, new Date(Date.now() - 5 * 60 * 1000)), // Last 5 minutes
      ),
      with: {
        file: true,
      },
    });

    // Notify for failed jobs
    for (const job of failedJobs) {
      if (job.metadata?.telegramChatId && !job.metadata?.notifiedFailure) {
        await notifyTranscriptionFailed(job.id);
        
        // Mark as notified
        await db.update(transcriptionJobs)
          .set({
            metadata: {
              ...job.metadata,
              notifiedFailure: true,
            },
          })
          .where(eq(transcriptionJobs.id, job.id));
      }
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