#!/bin/bash

# Setup Supabase Storage for Noti App
# This script ensures the required storage bucket exists with proper configuration

set -e

echo "🔧 Setting up Supabase storage..."

# Configuration
SUPABASE_URL="http://127.0.0.1:54321"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# Check if Supabase is running
echo "📡 Checking Supabase connection..."
if ! curl -f -s "$SUPABASE_URL/storage/v1/bucket" -H "Authorization: Bearer $SERVICE_ROLE_KEY" > /dev/null; then
    echo "❌ Supabase is not running. Please start it with: npx supabase start"
    exit 1
fi

echo "✅ Supabase is running"

# Create or update audio-files bucket
echo "🗄️ Creating audio-files storage bucket..."
BUCKET_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "audio-files",
    "name": "audio-files",
    "public": true,
    "file_size_limit": 104857600,
    "allowed_mime_types": ["audio/webm", "audio/wav", "audio/mp3", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/x-wav", "audio/wave"]
  }')

if echo "$BUCKET_RESPONSE" | grep -q "name"; then
    echo "✅ Bucket created successfully"
elif echo "$BUCKET_RESPONSE" | grep -q "already exists"; then
    echo "✅ Bucket already exists, updating configuration..."
    
    # Update existing bucket
    curl -s -X PUT "$SUPABASE_URL/storage/v1/bucket/audio-files" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "public": true,
        "file_size_limit": 104857600,
        "allowed_mime_types": ["audio/webm", "audio/wav", "audio/mp3", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/x-wav", "audio/wave"]
      }' > /dev/null
    
    echo "✅ Bucket updated successfully"
else
    echo "❌ Failed to create bucket: $BUCKET_RESPONSE"
    exit 1
fi

# Verify bucket exists
echo "🔍 Verifying bucket configuration..."
VERIFY_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY")

if echo "$VERIFY_RESPONSE" | grep -q "audio-files"; then
    echo "✅ Storage setup complete!"
    echo "📊 Bucket details:"
    echo "$VERIFY_RESPONSE" | jq '.[] | select(.id=="audio-files")'
else
    echo "❌ Bucket verification failed"
    exit 1
fi

echo ""
echo "🎉 Storage setup successful! You can now upload audio files."