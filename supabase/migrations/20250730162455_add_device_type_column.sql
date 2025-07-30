-- Add device_type column to audio_files table
ALTER TABLE "audio_files" 
ADD COLUMN "device_type" TEXT DEFAULT 'unknown' NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN "audio_files"."device_type" IS 'Device type where recording was made: mobile, tablet, desktop, or unknown';