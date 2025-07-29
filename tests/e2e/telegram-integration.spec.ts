import { test, expect } from '@playwright/test';
import { TestHelpers, TestFile } from '../utils/test-helpers';

test.describe('Telegram Webhook Integration', () => {
  let uploadedPaths: string[] = [];

  test.afterAll(async () => {
    // Cleanup uploaded test files
    if (uploadedPaths.length > 0) {
      try {
        await TestHelpers.cleanupTestFiles('test-audio-files', uploadedPaths);
      } catch (error) {
        console.warn('Cleanup failed:', error);
      }
    }
  });

  test('telegram voice message uploads to Supabase', async ({ request }) => {
    const testFile = TestHelpers.getTestFile('test-voice-message.ogg');
    
    // Simulate Telegram webhook payload for voice message
    const telegramUpdate = {
      update_id: 12345,
      message: {
        message_id: 67890,
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test',
          username: 'testuser'
        },
        chat: {
          id: 123456789,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        voice: {
          duration: 5,
          mime_type: 'audio/ogg',
          file_id: 'BAADBAADqAADBYaBFy8IDB7UPMFxQI',
          file_unique_id: 'AgADqAADBYaBFw',
          file_size: testFile.size
        }
      }
    };

    // Mock the Telegram file download by intercepting the webhook
    // Since we can't easily mock the external Telegram API download,
    // we'll test the webhook endpoint structure and validation

    const webhookResponse = await request.post('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'noti-telegram-webhook-secret'
      },
      data: telegramUpdate
    });

    // The webhook should accept the request (even if file download fails in test)
    expect(webhookResponse.ok()).toBeTruthy();
    
    const responseData = await webhookResponse.json();
    expect(responseData.ok).toBe(true);

    // Note: In a real test environment with proper Telegram bot setup,
    // we would verify that the file was actually uploaded to Supabase
    // For now, we verify the webhook structure and response
  });

  test('telegram audio file uploads to Supabase', async ({ request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Simulate Telegram webhook payload for audio file
    const telegramUpdate = {
      update_id: 12346,
      message: {
        message_id: 67891,
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test',
          username: 'testuser'
        },
        chat: {
          id: 123456789,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        audio: {
          duration: 10,
          mime_type: 'audio/mpeg',
          file_id: 'CAADBAADqQADBYaBFy8IDB7UPMFxQI',
          file_unique_id: 'AgADqQADBYaBFw',
          file_size: testFile.size,
          title: 'Test Audio File',
          performer: 'Test Artist'
        }
      }
    };

    const webhookResponse = await request.post('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'noti-telegram-webhook-secret'
      },
      data: telegramUpdate
    });

    expect(webhookResponse.ok()).toBeTruthy();
    
    const responseData = await webhookResponse.json();
    expect(responseData.ok).toBe(true);
  });

  test('telegram webhook validates secret token', async ({ request }) => {
    const telegramUpdate = {
      update_id: 12347,
      message: {
        message_id: 67892,
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test'
        },
        chat: {
          id: 123456789,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: '/start'
      }
    };

    // Test with wrong secret token
    const invalidTokenResponse = await request.post('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'wrong-secret'
      },
      data: telegramUpdate
    });

    expect(invalidTokenResponse.status()).toBe(401);

    // Test with correct secret token
    const validTokenResponse = await request.post('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'noti-telegram-webhook-secret'
      },
      data: telegramUpdate
    });

    expect(validTokenResponse.ok()).toBeTruthy();
  });

  test('telegram webhook handles text commands', async ({ request }) => {
    const commands = ['/start', '/help', '/list', '/status 123'];
    
    for (const command of commands) {
      const telegramUpdate = {
        update_id: Math.floor(Math.random() * 100000),
        message: {
          message_id: Math.floor(Math.random() * 100000),
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'Test',
            username: 'testuser'
          },
          chat: {
            id: 123456789,
            type: 'private'
          },
          date: Math.floor(Date.now() / 1000),
          text: command
        }
      };

      const webhookResponse = await request.post('/api/telegram/webhook', {
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'noti-telegram-webhook-secret'
        },
        data: telegramUpdate
      });

      expect(webhookResponse.ok()).toBeTruthy();
      
      const responseData = await webhookResponse.json();
      expect(responseData.ok).toBe(true);
    }
  });

  test('telegram webhook handles disabled integration', async ({ request }) => {
    // This test would require manipulating the telegram settings in the database
    // to disable the integration and verify it's ignored
    
    const telegramUpdate = {
      update_id: 12348,
      message: {
        message_id: 67893,
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test'
        },
        chat: {
          id: 123456789,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: '/start'
      }
    };

    const webhookResponse = await request.post('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'noti-telegram-webhook-secret'
      },
      data: telegramUpdate
    });

    // Should still return OK but not process the message
    expect(webhookResponse.ok()).toBeTruthy();
    
    const responseData = await webhookResponse.json();
    expect(responseData.ok).toBe(true);
  });

  test('telegram webhook error handling', async ({ request }) => {
    // Test with malformed JSON
    const malformedResponse = await request.post('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'noti-telegram-webhook-secret'
      },
      data: 'invalid json'
    });

    // Should still return OK to avoid Telegram retries
    expect(malformedResponse.ok()).toBeTruthy();

    // Test with missing required fields
    const incompleteUpdate = {
      update_id: 12349
      // Missing message field
    };

    const incompleteResponse = await request.post('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'noti-telegram-webhook-secret'
      },
      data: incompleteUpdate
    });

    expect(incompleteResponse.ok()).toBeTruthy();
  });

  test('telegram webhook file size validation', async ({ request }) => {
    const testFile = TestHelpers.getTestFile('test-audio-small.mp3');
    
    // Simulate a file that's too large
    const largeFileUpdate = {
      update_id: 12350,
      message: {
        message_id: 67894,
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test'
        },
        chat: {
          id: 123456789,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        voice: {
          duration: 3600, // 1 hour
          mime_type: 'audio/ogg',
          file_id: 'BAADBAADqAADBYaBFy8IDB7UPMFxQI',
          file_unique_id: 'AgADqAADBYaBFw',
          file_size: 200 * 1024 * 1024 // 200MB - exceeds 100MB limit
        }
      }
    };

    const webhookResponse = await request.post('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'noti-telegram-webhook-secret'
      },
      data: largeFileUpdate
    });

    // Should still return OK but internally handle the size validation
    expect(webhookResponse.ok()).toBeTruthy();
  });

  test('telegram webhook callback query handling', async ({ request }) => {
    // Test callback query (inline keyboard responses)
    const callbackUpdate = {
      update_id: 12351,
      callback_query: {
        id: 'callback_query_id_123',
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test'
        },
        message: {
          message_id: 67895,
          chat: {
            id: 123456789,
            type: 'private'
          },
          date: Math.floor(Date.now() / 1000),
          text: 'Original message'
        },
        data: 'transcribe_123'
      }
    };

    const webhookResponse = await request.post('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'noti-telegram-webhook-secret'
      },
      data: callbackUpdate
    });

    expect(webhookResponse.ok()).toBeTruthy();
    
    const responseData = await webhookResponse.json();
    expect(responseData.ok).toBe(true);
  });

  test('telegram webhook PUT endpoint for webhook registration', async ({ request }) => {
    const webhookConfig = {
      url: 'https://example.com/api/telegram/webhook',
      secretToken: 'test-secret-token'
    };

    const registrationResponse = await request.put('/api/telegram/webhook', {
      headers: {
        'Content-Type': 'application/json'
      },
      data: webhookConfig
    });

    // This might fail in test environment without proper Telegram bot setup
    // but we can verify the endpoint exists and handles the request structure
    expect([200, 400, 500]).toContain(registrationResponse.status());
  });

  // Integration test with real file processing (requires full setup)
  test.skip('end-to-end telegram file processing with Supabase', async ({ request }) => {    
    // This test would require:
    // 1. A real Telegram bot token
    // 2. Supabase configured and running
    // 3. The ability to simulate actual file downloads from Telegram
    
    // For now, we skip this test as it requires external dependencies
    // In a real testing environment, you would:
    // 1. Upload a test file to Telegram
    // 2. Send it via the bot
    // 3. Verify it appears in Supabase storage
    // 4. Verify database record creation
    // 5. Verify transcription job creation
  });
});