-- Seed data for Supabase local development
-- This file ensures required storage buckets are created

-- Create audio-files storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-files',
  'audio-files', 
  false,
  104857600, -- 100MB
  ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the audio-files bucket
-- Allow authenticated users to upload files
INSERT INTO storage.policies (id, bucket_id, command, definition)
VALUES (
  'audio-files-upload',
  'audio-files',
  'INSERT',
  'true'
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to select/download their files  
INSERT INTO storage.policies (id, bucket_id, command, definition)
VALUES (
  'audio-files-select',
  'audio-files', 
  'SELECT',
  'true'
)
ON CONFLICT (id) DO NOTHING;