#!/usr/bin/env node

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';

const sqlite = new Database('./data/noti.db');
const db = drizzle(sqlite);

console.log('Adding Telegram notification tables...');

try {
  // Create telegram_notification_preferences table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS telegram_notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      transcription_complete INTEGER DEFAULT 1,
      transcription_failed INTEGER DEFAULT 1,
      summary_ready INTEGER DEFAULT 1,
      daily_digest INTEGER DEFAULT 0,
      weekly_report INTEGER DEFAULT 0,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      timezone TEXT DEFAULT 'UTC',
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS telegram_notif_prefs_chat_id_idx 
    ON telegram_notification_preferences(chat_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS telegram_notif_prefs_user_id_idx 
    ON telegram_notification_preferences(user_id)
  `);

  console.log('✅ Created telegram_notification_preferences table');

  // Create telegram_users table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS telegram_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language_code TEXT,
      can_transcribe INTEGER DEFAULT 1,
      can_summarize INTEGER DEFAULT 1,
      is_admin INTEGER DEFAULT 0,
      daily_transcription_limit INTEGER DEFAULT 10,
      monthly_transcription_limit INTEGER DEFAULT 100,
      total_transcriptions INTEGER DEFAULT 0,
      last_active_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS telegram_users_telegram_id_idx 
    ON telegram_users(telegram_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS telegram_users_username_idx 
    ON telegram_users(username)
  `);

  console.log('✅ Created telegram_users table');

  // Create telegram_scheduled_notifications table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS telegram_scheduled_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('daily_digest', 'weekly_report', 'custom')),
      schedule_time TEXT NOT NULL,
      schedule_days TEXT,
      next_run_at INTEGER NOT NULL,
      template TEXT,
      filters TEXT,
      is_active INTEGER DEFAULT 1,
      last_run_at INTEGER,
      last_run_status TEXT CHECK(last_run_status IN ('success', 'failed', 'skipped')),
      last_run_error TEXT,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS telegram_scheduled_notif_chat_id_idx 
    ON telegram_scheduled_notifications(chat_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS telegram_scheduled_notif_next_run_idx 
    ON telegram_scheduled_notifications(next_run_at)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS telegram_scheduled_notif_active_idx 
    ON telegram_scheduled_notifications(is_active)
  `);

  console.log('✅ Created telegram_scheduled_notifications table');

  console.log('\n✅ All Telegram notification tables created successfully!');

} catch (error) {
  console.error('❌ Error creating tables:', error);
  process.exit(1);
} finally {
  sqlite.close();
}