CREATE TYPE "public"."ai_extract_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."summary_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transcription_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "ai_extracts" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"template_id" text,
	"model" text NOT NULL,
	"prompt" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"original_file_name" text NOT NULL,
	"original_file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"duration" integer,
	"transcript" jsonb,
	"transcription_status" "transcription_status" DEFAULT 'pending' NOT NULL,
	"transcription_progress" integer DEFAULT 0,
	"language" text,
	"model_size" text DEFAULT 'large-v3',
	"threads" integer,
	"processors" integer,
	"diarization" boolean DEFAULT true,
	"summary" text,
	"summary_prompt" text,
	"summary_status" "summary_status" DEFAULT 'pending',
	"ai_extract" text,
	"ai_extract_status" "ai_extract_status" DEFAULT 'pending',
	"ai_extracted_at" timestamp,
	"ai_extract_file_path" text,
	"title" text,
	"last_error" text,
	"peaks" jsonb,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"transcribed_at" timestamp,
	"summarized_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speaker_labels" (
	"file_id" integer PRIMARY KEY NOT NULL,
	"labels" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summarization_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_initialized" boolean DEFAULT false NOT NULL,
	"first_startup_date" timestamp,
	"last_startup_date" timestamp,
	"whisper_model_sizes" text[] DEFAULT ARRAY['tiny', 'base', 'small', 'medium', 'large'],
	"whisper_quantization" text DEFAULT 'none',
	"obsidian_enabled" boolean DEFAULT false,
	"obsidian_vault_path" text,
	"obsidian_folder" text,
	"gemini_api_key" text,
	"openai_api_key" text,
	"openrouter_api_key" text,
	"ai_extract_enabled" boolean DEFAULT false,
	"ai_extract_prompt" text,
	"ai_extract_output_path" text,
	"ai_extract_model" text DEFAULT 'gemini-1.5-flash'
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "ai_extracts" ADD CONSTRAINT "ai_extracts_file_id_audio_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."audio_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_extracts" ADD CONSTRAINT "ai_extracts_template_id_summarization_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."summarization_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_labels" ADD CONSTRAINT "speaker_labels_file_id_audio_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."audio_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_id_idx" ON "ai_extracts" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "ai_extracts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transcription_status_idx" ON "audio_files" USING btree ("transcription_status");--> statement-breakpoint
CREATE INDEX "uploaded_at_idx" ON "audio_files" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "summary_status_idx" ON "audio_files" USING btree ("summary_status");--> statement-breakpoint
CREATE INDEX "title_idx" ON "summarization_templates" USING btree ("title");