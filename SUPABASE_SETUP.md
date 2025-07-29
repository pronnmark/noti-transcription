# 🚨 SUPABASE CONFIGURATION REQUIRED

## CRITICAL: Application Will Not Work Without Supabase Keys!

The application has been configured to use **Supabase Storage ONLY**. All local file storage has
been removed.

### 🔑 Required Environment Variables

Add these to your `.env` or `.env.local` file:

```env
# Supabase Storage Configuration
SUPABASE_URL=http://127.0.0.1:54321  # For local dev
SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
```

### 🚀 Quick Setup - Local Development

1. **Install Supabase CLI**:

   ```bash
   npm install -g supabase
   ```

2. **Start Supabase locally**:

   ```bash
   supabase init
   supabase start
   ```

3. **Get your local keys**:

   ```bash
   supabase status
   ```

   Copy the `anon key` and `service_role key` to your `.env` file.

4. **Create required buckets**:
   ```sql
   -- Run in Supabase SQL editor
   INSERT INTO storage.buckets (id, name, public) VALUES
   ('audio-files', 'audio-files', false),
   ('transcripts', 'transcripts', false);
   ```

### ☁️ Production Setup

1. Create a Supabase project at https://supabase.com
2. Go to Settings → API
3. Copy your project URL and keys to `.env`

### 🧪 Test Your Configuration

```bash
node scripts/test-supabase-connection.js
```

You should see:

```
✓ Supabase client created successfully
✓ Bucket 'audio-files' is accessible
✓ Bucket 'transcripts' is accessible
```

### 🔄 How It Works

1. **Upload**: Files are uploaded directly to Supabase Storage
2. **Transcription**: Files are temporarily downloaded from Supabase to `/tmp` for local Whisper
   processing
3. **Storage**: Results are stored in SQLite database (`sqlite.db`)
4. **Cleanup**: Temporary files are automatically deleted after processing

### ⚠️ Common Issues

1. **"Supabase key is required" error**: Add the environment variables
2. **"Bucket not found" error**: Create the buckets using the SQL above
3. **"Connection refused" error**: Start Supabase locally with `supabase start`

### 📝 Note

- Local Whisper transcription (Python/venv) is preserved and works seamlessly with Supabase Storage
- All file paths in the database now point to Supabase Storage paths
- The system automatically handles download/upload for Whisper processing
