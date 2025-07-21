CREATE TABLE `audio_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`original_file_name` text NOT NULL,
	`original_file_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_hash` text,
	`duration` integer,
	`transcript` text,
	`transcription_status` text DEFAULT 'pending' NOT NULL,
	`transcription_progress` integer DEFAULT 0,
	`language` text,
	`model_size` text DEFAULT 'large-v3',
	`threads` integer,
	`processors` integer,
	`diarization` integer DEFAULT true,
	`summary` text,
	`summary_prompt` text,
	`summary_status` text DEFAULT 'pending',
	`ai_extract` text,
	`ai_extract_status` text DEFAULT 'pending',
	`ai_extracted_at` integer,
	`ai_extract_file_path` text,
	`notes_extracted_at` text,
	`notes_status` text DEFAULT 'pending',
	`notes_count` text,
	`summarization_status` text DEFAULT 'pending',
	`summarization_content` text,
	`extraction_templates_used` text,
	`data_point_templates_used` text,
	`extraction_status` text DEFAULT 'pending',
	`data_point_status` text DEFAULT 'pending',
	`title` text,
	`last_error` text,
	`peaks` text,
	`uploaded_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`transcribed_at` integer,
	`summarized_at` integer,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audio_files_file_hash_unique` ON `audio_files` (`file_hash`);--> statement-breakpoint
CREATE INDEX `transcription_status_idx` ON `audio_files` (`transcription_status`);--> statement-breakpoint
CREATE INDEX `uploaded_at_idx` ON `audio_files` (`uploaded_at`);--> statement-breakpoint
CREATE INDEX `summary_status_idx` ON `audio_files` (`summary_status`);--> statement-breakpoint
CREATE TABLE `speaker_labels` (
	`file_id` integer PRIMARY KEY NOT NULL,
	`labels` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_extracts` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` integer NOT NULL,
	`template_id` text,
	`model` text NOT NULL,
	`prompt` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `summarization_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `file_id_idx` ON `ai_extracts` (`file_id`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `ai_extracts` (`created_at`);--> statement-breakpoint
CREATE TABLE `ai_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` integer NOT NULL,
	`note_type` text NOT NULL,
	`content` text NOT NULL,
	`context` text,
	`speaker` text,
	`timestamp` real,
	`priority` text DEFAULT 'medium',
	`status` text DEFAULT 'active',
	`metadata` text,
	`comments` text,
	`completed_at` text,
	`assigned_to` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `extraction_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`prompt` text NOT NULL,
	`expected_output_format` text,
	`default_priority` text DEFAULT 'medium',
	`is_active` integer DEFAULT true,
	`is_default` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `extraction_templates_active_idx` ON `extraction_templates` (`is_active`);--> statement-breakpoint
CREATE INDEX `extraction_templates_default_idx` ON `extraction_templates` (`is_default`);--> statement-breakpoint
CREATE TABLE `summarization_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `title_idx` ON `summarization_templates` (`title`);--> statement-breakpoint
CREATE TABLE `psychological_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` integer NOT NULL,
	`mood` text,
	`energy` integer,
	`stress_level` integer,
	`confidence` integer,
	`engagement` integer,
	`emotional_state` text,
	`speech_patterns` text,
	`key_insights` text NOT NULL,
	`timestamp_analysis` text,
	`model` text DEFAULT 'anthropic/claude-sonnet-4' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `psych_file_id_idx` ON `psychological_evaluations` (`file_id`);--> statement-breakpoint
CREATE INDEX `psych_created_at_idx` ON `psychological_evaluations` (`created_at`);--> statement-breakpoint
CREATE TABLE `psychological_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'default',
	`date` text NOT NULL,
	`average_mood` real,
	`average_energy` real,
	`average_stress` real,
	`session_count` integer DEFAULT 0,
	`dominant_emotion` text,
	`insights` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_date_idx` ON `psychological_metrics` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `metrics_date_idx` ON `psychological_metrics` (`date`);--> statement-breakpoint
CREATE TABLE `ai_processing_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` integer NOT NULL,
	`summarization_prompt_id` text,
	`extraction_definition_ids` text,
	`system_prompt` text NOT NULL,
	`ai_response` text NOT NULL,
	`parsed_response` text,
	`status` text DEFAULT 'pending',
	`error` text,
	`processing_time` integer,
	`token_count` integer,
	`model` text DEFAULT 'gemini-2.5-flash',
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`summarization_prompt_id`) REFERENCES `summarization_prompts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ai_sessions_file_id_idx` ON `ai_processing_sessions` (`file_id`);--> statement-breakpoint
CREATE INDEX `ai_sessions_status_idx` ON `ai_processing_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `ai_sessions_created_at_idx` ON `ai_processing_sessions` (`created_at`);--> statement-breakpoint
CREATE TABLE `data_point_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`analysis_prompt` text NOT NULL,
	`output_schema` text,
	`visualization_type` text DEFAULT 'chart',
	`is_active` integer DEFAULT true,
	`is_default` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `data_point_templates_active_idx` ON `data_point_templates` (`is_active`);--> statement-breakpoint
CREATE INDEX `data_point_templates_default_idx` ON `data_point_templates` (`is_default`);--> statement-breakpoint
CREATE TABLE `data_points` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` integer NOT NULL,
	`template_id` text NOT NULL,
	`analysis_results` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `data_point_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `data_points_file_id_idx` ON `data_points` (`file_id`);--> statement-breakpoint
CREATE INDEX `data_points_template_id_idx` ON `data_points` (`template_id`);--> statement-breakpoint
CREATE TABLE `extraction_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`json_key` text NOT NULL,
	`json_schema` text NOT NULL,
	`ai_instructions` text NOT NULL,
	`output_type` text DEFAULT 'array',
	`category` text DEFAULT 'extraction',
	`is_active` integer DEFAULT true,
	`sort_order` integer DEFAULT 0,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `extraction_definitions_json_key_unique` ON `extraction_definitions` (`json_key`);--> statement-breakpoint
CREATE INDEX `extr_def_name_idx` ON `extraction_definitions` (`name`);--> statement-breakpoint
CREATE INDEX `extr_def_json_key_idx` ON `extraction_definitions` (`json_key`);--> statement-breakpoint
CREATE INDEX `extr_def_category_idx` ON `extraction_definitions` (`category`);--> statement-breakpoint
CREATE INDEX `extr_def_active_idx` ON `extraction_definitions` (`is_active`);--> statement-breakpoint
CREATE TABLE `extraction_results` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` integer NOT NULL,
	`definition_id` text NOT NULL,
	`extraction_type` text NOT NULL,
	`content` text NOT NULL,
	`schema_version` text DEFAULT '1.0',
	`confidence` real,
	`processing_time` integer,
	`model` text DEFAULT 'gemini-2.5-flash',
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`definition_id`) REFERENCES `extraction_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `extr_results_file_id_idx` ON `extraction_results` (`file_id`);--> statement-breakpoint
CREATE INDEX `extr_results_def_id_idx` ON `extraction_results` (`definition_id`);--> statement-breakpoint
CREATE INDEX `extr_results_type_idx` ON `extraction_results` (`extraction_type`);--> statement-breakpoint
CREATE INDEX `extr_results_created_at_idx` ON `extraction_results` (`created_at`);--> statement-breakpoint
CREATE TABLE `extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` integer NOT NULL,
	`template_id` text NOT NULL,
	`content` text NOT NULL,
	`context` text,
	`speaker` text,
	`timestamp` real,
	`priority` text DEFAULT 'medium',
	`status` text DEFAULT 'active',
	`metadata` text,
	`comments` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `extraction_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `extractions_file_id_idx` ON `extractions` (`file_id`);--> statement-breakpoint
CREATE INDEX `extractions_template_id_idx` ON `extractions` (`template_id`);--> statement-breakpoint
CREATE INDEX `extractions_status_idx` ON `extractions` (`status`);--> statement-breakpoint
CREATE TABLE `summarization_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`prompt` text NOT NULL,
	`is_default` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `summ_prompts_name_idx` ON `summarization_prompts` (`name`);--> statement-breakpoint
CREATE INDEX `summ_prompts_default_idx` ON `summarization_prompts` (`is_default`);--> statement-breakpoint
CREATE TABLE `summarizations` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` integer NOT NULL,
	`template_id` text,
	`model` text NOT NULL,
	`prompt` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `summarization_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `summarizations_file_id_idx` ON `summarizations` (`file_id`);--> statement-breakpoint
CREATE INDEX `summarizations_template_id_idx` ON `summarizations` (`template_id`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_initialized` integer DEFAULT false NOT NULL,
	`first_startup_date` integer,
	`last_startup_date` integer,
	`whisper_model_sizes` text DEFAULT '["tiny","base","small","medium","large"]',
	`whisper_quantization` text DEFAULT 'none',
	`obsidian_enabled` integer DEFAULT false,
	`obsidian_vault_path` text,
	`obsidian_folder` text,
	`gemini_api_key` text,
	`openai_api_key` text,
	`openrouter_api_key` text,
	`ai_extract_enabled` integer DEFAULT false,
	`ai_extract_prompt` text,
	`ai_extract_output_path` text,
	`ai_extract_model` text DEFAULT 'anthropic/claude-sonnet-4',
	`notes_prompts` text,
	`psych_eval_enabled` integer DEFAULT false,
	`psych_eval_auto_run` integer DEFAULT false,
	`extraction_auto_run` text
);
