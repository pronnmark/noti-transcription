# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Development
npm run dev              # Start dev server on port 5173
npm run dev:https        # Start dev server with HTTPS
npm run build            # Build for production
npm run start            # Start production server on port 5173

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues automatically
npm run format           # Format code with Prettier
npm run clean            # Run lint:fix + format

# Testing
npm run test             # Run Vitest unit tests
npm run test:run         # Run tests once (CI mode)
npm run test:coverage    # Run tests with coverage
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Run E2E tests with UI

# Database
npm run db:init          # Initialize database
npm run db:status        # Check database status
npm run db:reset         # Reset database (requires --confirm)
npm run migrate          # Run database migrations
```

## Architecture Overview

**Noti** is a Next.js 15 PWA for AI-powered audio transcription with speaker diarization. It follows a modular, dependency-injected architecture.

### Core Technology Stack
- **Frontend**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS
- **Storage**: Supabase (auth, database, file storage)
- **AI**: Google Gemini API, local Whisper transcription
- **State**: Zustand stores, TanStack Query
- **Testing**: Vitest (unit), Playwright (E2E)
- **UI**: Radix UI components, shadcn/ui design system

### Architecture Patterns

#### Dependency Injection Container
Uses a custom DI container (`src/lib/di/DIContainer.ts`) with service tokens:
- Database clients and repositories are registered as singletons
- Services follow SOLID principles with clear separation of concerns
- Tokens are defined in `TOKENS` constant for type safety

#### Repository Pattern
Database access is abstracted through repositories (`src/lib/database/repositories/`):
- `AudioRepository` - Audio file metadata
- `TranscriptRepository` - Transcription data and jobs
- `SummarizationRepository` - AI processing results
- All inherit from `BaseRepository` with common CRUD operations

#### Service Layer Architecture
Three-tier service architecture (`src/lib/services/`):
- **Core Services** (`core/`): File handling, transcription, storage
- **AI Services** (`ai/`): Gemini integration, prompt engineering
- **Infrastructure**: Error handling, validation, middleware

#### Middleware Pipeline
Request processing through middleware orchestrator:
- Authentication via Supabase JWT
- Request context enrichment
- Error handling and logging
- Response formatting

### Key Architectural Decisions

#### Supabase-First Storage
All file operations use Supabase Storage with temporary local processing:
- Audio files uploaded to `audio-files` bucket
- Transcripts stored in `transcripts` bucket
- Local Whisper processing downloads temporarily to `/tmp`

#### PWA Implementation
Full Progressive Web App with:
- Service worker for offline capability
- Manifest for installability
- Responsive design with mobile-first approach

#### Authentication Strategy
Supabase Auth with:
- JWT tokens for API authentication
- Row Level Security (RLS) for data access
- Service role key for backend operations

## Development Guidelines

### Code Organization
- **API Routes**: Follow RESTful patterns in `src/app/api/`
- **Components**: Atomic design with UI components in `src/components/ui/`
- **Stores**: Zustand stores in `src/stores/` for client state
- **Types**: Database types generated from Supabase schema

### Testing Strategy
- **Unit Tests**: Service layer and utility functions
- **E2E Tests**: Critical user journeys with Playwright
- **Manual Testing**: Database setup required (see TODO_SUMMARY.md)

## Critical Implementation Notes

### Missing Database Schema
Some features are stubbed due to missing Supabase tables:
- Complete summarization templates implementation

### Security Considerations
- Worker endpoint (`/api/worker/transcribe`) bypasses auth for testing
- Must implement proper authentication before production deployment

### AI Processing Pipeline
1. File upload to Supabase Storage
2. Transcription job queued with pg-boss
3. File downloaded to `/tmp` for Whisper processing
4. Results stored in database and cleanup temporary files
5. Optional AI processing (summarization, speaker analysis)

### Mobile-First Design
Responsive layout with:
- Bottom navigation for mobile
- Sidebar navigation for desktop
- Touch-optimized interactions
- PWA installation prompts

## Important File Locations

- **Database initialization**: `src/lib/database/init.ts`
- **Service registration**: `src/lib/di/containerSetup.ts`
- **Middleware orchestration**: `src/lib/middleware/MiddlewareOrchestrator.ts`
- **Transcription service**: `src/lib/services/core/TranscriptionService.ts`
- **Supabase client**: `src/lib/database/client.ts`