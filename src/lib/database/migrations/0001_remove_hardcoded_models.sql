-- Migration to remove hardcoded AI model defaults
-- Generated on 2025-07-19

-- Remove defaults from system_settings table
ALTER TABLE `system_settings` ALTER COLUMN `ai_extract_model` DROP DEFAULT;

-- Remove defaults from psychological_evaluations table  
ALTER TABLE `psychological_evaluations` ALTER COLUMN `model` DROP DEFAULT;

-- Update any existing records that have the hardcoded model
UPDATE `system_settings` SET `ai_extract_model` = NULL WHERE `ai_extract_model` = 'anthropic/claude-sonnet-4';
UPDATE `psychological_evaluations` SET `model` = 'unconfigured' WHERE `model` = 'anthropic/claude-sonnet-4';