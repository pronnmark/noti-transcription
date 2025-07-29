-- Create audio_files table
CREATE TABLE "audio_files" (
  "id" SERIAL PRIMARY KEY,
  "file_name" TEXT NOT NULL,
  "original_file_name" TEXT NOT NULL,
  "original_file_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "file_hash" TEXT UNIQUE,
  "duration" INTEGER,
  "title" TEXT,
  "peaks" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "location_accuracy" INTEGER,
  "location_timestamp" TIMESTAMP,
  "location_provider" TEXT,
  "uploaded_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "recorded_at" TIMESTAMP
);

-- Create transcription_jobs table
CREATE TABLE "transcription_jobs" (
  "id" SERIAL PRIMARY KEY,
  "file_id" INTEGER NOT NULL REFERENCES "audio_files"("id") ON DELETE CASCADE,
  "language" TEXT,
  "model_size" TEXT DEFAULT 'large-v3',
  "threads" INTEGER,
  "processors" INTEGER,
  "diarization" BOOLEAN DEFAULT true,
  "speaker_count" INTEGER,
  "status" TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'draft')),
  "progress" INTEGER DEFAULT 0,
  "transcript" JSONB,
  "diarization_status" TEXT DEFAULT 'not_attempted' CHECK (diarization_status IN ('not_attempted', 'in_progress', 'success', 'failed', 'no_speakers_detected')),
  "diarization_error" TEXT,
  "last_error" TEXT,
  "started_at" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create speaker_labels table
CREATE TABLE "speaker_labels" (
  "file_id" INTEGER PRIMARY KEY REFERENCES "audio_files"("id") ON DELETE CASCADE,
  "labels" JSONB NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create file_labels table
CREATE TABLE "file_labels" (
  "id" SERIAL PRIMARY KEY,
  "file_id" INTEGER NOT NULL REFERENCES "audio_files"("id") ON DELETE CASCADE,
  "labels" JSONB DEFAULT '[]' NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX "audio_files_file_hash_idx" ON "audio_files" ("file_hash");
CREATE INDEX "audio_files_uploaded_at_idx" ON "audio_files" ("uploaded_at");
CREATE INDEX "transcription_jobs_file_id_idx" ON "transcription_jobs" ("file_id");
CREATE INDEX "transcription_jobs_status_idx" ON "transcription_jobs" ("status");
CREATE INDEX "transcription_jobs_created_at_idx" ON "transcription_jobs" ("created_at");
CREATE INDEX "file_labels_file_id_idx" ON "file_labels" ("file_id");
CREATE INDEX "file_labels_labels_idx" ON "file_labels" USING GIN ("labels");