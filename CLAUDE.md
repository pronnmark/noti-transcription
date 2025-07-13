# Noti - AI Audio Transcription with Speaker Diarization

## Project Overview

Noti is a Next.js TypeScript implementation of an AI-powered audio transcription application with advanced speaker diarization capabilities. This is a modern React-based alternative to the SvelteKit Scriberr project, offering the same powerful transcription features with a different tech stack.

## Key Features

### 🎯 Core Capabilities
- **Audio Transcription**: Powered by WhisperX with GPU acceleration
- **Speaker Diarization**: Automatic speaker detection and labeling using PyAnnote
- **Large-v3 Model**: Always uses the most accurate Whisper model for best results
- **Multi-Language Support**: Swedish by default, extensible to other languages
- **Real-time Progress**: Track transcription progress with status updates
- **File Management**: Upload, list, and manage audio files with metadata

### 🔧 Technical Features
- **GPU/CPU Fallback**: Automatically falls back to CPU if GPU fails
- **WAV Conversion**: Automatic audio format conversion for compatibility
- **File-based Storage**: No database required - uses local filesystem
- **Session Authentication**: Simple, passwordless authentication system
- **TypeScript**: Full type safety throughout the application
- **Responsive UI**: Mobile-friendly interface with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Storage**: File-based (no database required)
- **Authentication**: Session-based with JWT tokens
- **Transcription**: WhisperX (Python) via subprocess
- **Speaker Diarization**: PyAnnote with HuggingFace models

## Project Structure

```
noti/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   │   ├── check/     # Session validation
│   │   │   │   ├── login/     # Login endpoint
│   │   │   │   └── logout/    # Logout endpoint
│   │   │   ├── files/         # File management
│   │   │   │   └── [id]/      # Get file by ID
│   │   │   ├── transcript/    # Transcript retrieval
│   │   │   │   └── [id]/      # Get transcript by ID
│   │   │   ├── upload/        # Audio file upload
│   │   │   └── health/        # Health check
│   │   ├── login/             # Login page
│   │   └── page.tsx           # Main dashboard
│   ├── components/            # React components
│   │   └── ui/               # shadcn/ui components
│   ├── lib/                   # Core libraries
│   │   ├── auth.ts           # Authentication logic
│   │   ├── fileDb.ts         # File storage system
│   │   ├── transcription.ts  # Transcription service
│   │   └── utils.ts          # Utilities
│   └── middleware.ts         # Auth middleware
├── data/                      # File storage directory
│   ├── audio_files/          # Uploaded audio files
│   ├── transcripts/          # Transcription results
│   └── metadata.json         # File metadata
└── public/                   # Static assets
```

## Transcription Configuration

### Model Settings
```typescript
const MODEL_SIZE = 'large-v3';  // Always use the biggest, most accurate model
const ENABLE_DIARIZATION = true; // Always enable speaker detection
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || 'your-huggingface-token-here';
```

### Language Settings
- Default: Swedish (`sv`)
- Can be modified in the transcription service
- Supports all languages that Whisper supports

### GPU Configuration
- Primary: CUDA GPU transcription for speed
- Fallback: CPU transcription if GPU fails
- Automatic detection and switching

## API Endpoints

### Authentication
- `POST /api/auth/login` - Create session (no password required)
- `POST /api/auth/logout` - End session
- `GET /api/auth/check` - Verify authentication status

### File Management
- `POST /api/upload` - Upload audio file with automatic transcription
- `GET /api/files` - List all uploaded files with metadata
- `GET /api/files/[id]` - Get specific file information

### Transcription
- `GET /api/transcript/[id]` - Get transcript with speaker information
  - Returns segments with timestamps and speaker labels
  - Includes `hasSpeakers` flag to indicate if diarization worked

### System
- `GET /api/health` - Health check endpoint

## Development Commands

```bash
# Navigate to project
cd /home/philip/Documents/projects/noti

# Install dependencies
npm install

# Start development server (port 5173)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Type checking
npm run type-check
```

## Environment Variables

Create `.env.local`:
```env
# File storage directory (optional, defaults to ./data)
DATA_DIR=./data

# Node environment
NODE_ENV=development

# Optional: OpenAI API key for future AI features
OPENAI_API_KEY=

# Optional: Custom HuggingFace token (defaults to embedded token)
HUGGINGFACE_TOKEN=
```

## Authentication Flow

1. **No Password Required**: Click "Enter Dashboard" to create session
2. **Session Creation**: 24-hour JWT token generated
3. **Cookie Storage**: Session stored in httpOnly cookie
4. **Middleware Protection**: All routes except /login are protected
5. **Auto-redirect**: Unauthenticated users sent to /login

## File Upload & Transcription Flow

1. **Upload**: Audio file uploaded via multipart form
2. **Storage**: File saved to `data/audio_files/`
3. **Conversion**: Automatic conversion to WAV format
4. **Transcription Start**: Background process initiated
5. **GPU Attempt**: First tries CUDA GPU transcription
6. **CPU Fallback**: Falls back to CPU if GPU fails
7. **Status Updates**: File status tracked (pending → processing → completed/failed)
8. **Speaker Detection**: PyAnnote identifies different speakers
9. **Result Storage**: Transcript saved to `data/transcripts/`

## Speaker Diarization

### How It Works
1. **PyAnnote Model**: Uses `pyannote/speaker-diarization-3.1`
2. **HuggingFace Token**: Required for model access (included)
3. **Speaker Assignment**: Labels speakers as SPEAKER_00, SPEAKER_01, etc.
4. **Segment Mapping**: Each transcript segment gets speaker assignment
5. **Frontend Display**: Can rename speakers in the UI (future feature)

### Example Output
```json
{
  "segments": [
    {
      "start": 0.5,
      "end": 3.2,
      "text": "Hello, how are you today?",
      "speaker": "SPEAKER_00"
    },
    {
      "start": 3.5,
      "end": 5.8,
      "text": "I'm doing great, thanks!",
      "speaker": "SPEAKER_01"
    }
  ]
}
```

## Python Integration

The project uses the Python environment from the main Scriberr project:
- **Python Path**: `/home/philip/Documents/projects/Scriberr/venv/bin/python`
- **Working Directory**: `/home/philip/Documents/projects/Scriberr`
- **Script**: `transcribe.py` in the Scriberr project

This ensures consistency between both implementations and reuses the existing Python dependencies.

## Differences from SvelteKit Version

### Architecture
- **Framework**: Next.js App Router vs SvelteKit
- **Components**: React TSX vs Svelte components
- **State Management**: React hooks vs Svelte stores
- **Routing**: File-based with `route.ts` vs `+server.ts`

### Features
- **Same Core Features**: Transcription, diarization, file management
- **Simplified UI**: Focused on core functionality
- **No Database**: Pure file-based storage
- **Passwordless Auth**: Simplified authentication

### Benefits
- **React Ecosystem**: Access to vast React component libraries
- **Next.js Features**: Built-in optimizations, middleware, API routes
- **TypeScript First**: Better type inference with React
- **Deployment Flexibility**: Easy deployment to Vercel, AWS, etc.

## Common Tasks

### Adding New API Endpoints
```typescript
// src/app/api/your-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Check authentication
  const isAuthenticated = await requireAuth(request);
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Your logic here
  return NextResponse.json({ data: 'success' });
}
```

### Modifying Transcription Settings
Edit `src/lib/transcription.ts`:
- Change `MODEL_SIZE` for different Whisper models
- Modify language in the args array
- Adjust GPU/CPU logic

### Custom File Storage
Edit `src/lib/fileDb.ts`:
- Change `DATA_DIR` for different storage location
- Modify metadata structure
- Add new file operations

## Deployment

### Local Deployment
```bash
npm run build
npm start
```

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "start"]
```

### Production Considerations
1. **Session Storage**: Currently in-memory, consider Redis for production
2. **File Storage**: Consider S3 or similar for cloud deployment
3. **Authentication**: Add proper user management for multi-user scenarios
4. **Rate Limiting**: Add API rate limiting for public deployment
5. **Monitoring**: Add logging and monitoring solutions

## Troubleshooting

### Common Issues

1. **Transcription Fails**
   - Check Python path exists: `/home/philip/Documents/projects/Scriberr/venv/bin/python`
   - Verify HuggingFace token is valid
   - Check GPU drivers if using CUDA

2. **Upload Fails**
   - Ensure `data/` directory is writable
   - Check file size limits (100MB default)
   - Verify audio format is supported

3. **Build Errors**
   - Run `npm install` to ensure dependencies
   - Check Node.js version (20+ recommended)
   - Clear `.next` folder and rebuild

4. **Authentication Issues**
   - Clear browser cookies
   - Check session expiry (24 hours)
   - Verify middleware is not blocking routes

## Future Enhancements

- [ ] Real-time transcription progress via WebSockets
- [ ] Multiple user support with proper authentication
- [ ] Cloud storage integration (S3, Google Cloud Storage)
- [ ] Advanced speaker label editing in UI
- [ ] Export transcripts in multiple formats
- [ ] Batch transcription support
- [ ] API key management for external access
- [ ] Transcription queue management UI
- [ ] Advanced audio preprocessing options
- [ ] Integration with translation services

## Security Considerations

1. **Authentication**: Simple session-based, not suitable for public internet
2. **File Access**: No authorization on file access beyond session check
3. **Input Validation**: Basic validation on file uploads
4. **CORS**: Not configured, same-origin only
5. **Secrets**: HuggingFace token embedded (consider environment variable)

## Performance Optimization

1. **Transcription**: GPU provides 5-10x speedup over CPU
2. **File Storage**: Local filesystem is fast but not scalable
3. **Caching**: No caching implemented, consider for production
4. **Batch Processing**: Single file at a time, could parallelize
5. **Memory**: Transcription is memory intensive, monitor usage

## Contributing

When contributing to this project:
1. Maintain TypeScript strict mode
2. Follow existing code patterns
3. Add proper error handling
4. Update this documentation
5. Test both GPU and CPU paths
6. Ensure speaker diarization works

---

This Next.js implementation provides a modern, type-safe alternative to the SvelteKit version while maintaining all core functionality including advanced speaker diarization.