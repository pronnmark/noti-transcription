-- Seed data for Supabase local development
-- This file ensures required storage buckets are created

-- Create audio-files storage bucket if it doesn't exist
-- Note: Making bucket public to avoid RLS policy complications in development
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-files',
  'audio-files', 
  true, -- Public bucket to bypass RLS in development
  104857600, -- 100MB
  ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/x-wav', 'audio/wave']
)
ON CONFLICT (id) DO NOTHING;