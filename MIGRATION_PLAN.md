# Noti Next.js Migration Plan - Premium Dashboard Implementation

## Overview
Transform the current basic Noti Next.js app into a premium, feature-rich transcription dashboard matching the Scriberr SvelteKit application.

## Phase 1: Database & Core Infrastructure (Priority: Critical)

### 1.1 PostgreSQL Setup with Drizzle ORM
- [ ] Install dependencies: `drizzle-orm`, `drizzle-kit`, `postgres`, `@types/pg`
- [ ] Create database schema matching Scriberr:
  - `users` table (for future multi-user support)
  - `sessions` table
  - `system_settings` table
  - `audio_files` table with full metadata
  - `speaker_labels` table
  - `summarization_templates` table
  - `ai_extracts` table (new table for extraction history)
- [ ] Set up Drizzle config and migrations
- [ ] Create database connection utilities
- [ ] Migrate from file-based storage to PostgreSQL

### 1.2 Job Queue Implementation
- [ ] Install `pg-boss` for background job processing
- [ ] Set up job workers for:
  - Transcription processing
  - AI extraction
  - File cleanup
- [ ] Implement progress tracking with Server-Sent Events

## Phase 2: Premium Dashboard UI (Priority: High)

### 2.1 Layout & Navigation
- [ ] Create sidebar navigation component with:
  - Home (Files & Transcripts)
  - Record (Audio Recording)
  - Settings (Configuration)
- [ ] Implement responsive mobile layout
- [ ] Add glass morphism design system
- [ ] Dark/light theme support

### 2.2 Dashboard Tabs System
- [ ] Create tabs component using shadcn/ui
- [ ] Implement main dashboard views:
  - **All Files** tab: Grid/list view of uploaded files
  - **Transcripts** tab: Completed transcriptions with search
  - **Processing** tab: Active transcription queue
  - **AI Extracts** tab: All AI-generated summaries

### 2.3 File Management UI
- [ ] Enhanced upload component with:
  - Drag-and-drop zone
  - Progress indicators
  - Multi-file support
- [ ] File cards showing:
  - Thumbnail/waveform preview
  - Duration, size, date
  - Status indicators
  - Quick actions (play, view, extract, delete)
- [ ] Inline file renaming
- [ ] Batch operations support

## Phase 3: Transcript Viewer (Priority: High)

### 3.1 Transcript Display
- [ ] Create transcript viewer component with:
  - Timestamp display
  - Speaker color coding
  - Search/highlight functionality
  - Copy to clipboard
- [ ] Implement speaker label editing
- [ ] Add export options (TXT, SRT, VTT, JSON)

### 3.2 Audio Player Integration
- [ ] Install and configure WaveSurfer.js
- [ ] Create audio player component with:
  - Waveform visualization
  - Playback controls
  - Speed adjustment
  - Click-to-seek on transcript
- [ ] Sync playback with transcript highlighting

## Phase 4: AI Extraction Features (Priority: High)

### 4.1 AI Provider Integration
- [ ] Create AI service abstraction layer
- [ ] Implement providers:
  - Google Gemini API
  - OpenRouter (Claude)
  - OpenAI (future)
- [ ] Add API key management in settings

### 4.2 Template System
- [ ] Create template management UI:
  - Pre-built templates (Meeting, Interview, Lecture, etc.)
  - Custom template creation
  - Template editor with variables
- [ ] Implement template storage in database
- [ ] Add template sharing functionality

### 4.3 Extraction UI
- [ ] Create extraction modal/panel with:
  - Template selection
  - Custom prompt input
  - Model selection
  - Extract button with loading state
- [ ] Display extraction results inline
- [ ] Save extraction history per file
- [ ] Export to Markdown/Obsidian

## Phase 5: Settings & Configuration (Priority: Medium)

### 5.1 Settings Page
- [ ] Create comprehensive settings UI with sections:
  - **Transcription**: Model, language, device settings
  - **AI Processing**: Enable/disable, default model
  - **Storage**: Local paths, Obsidian integration
  - **Appearance**: Theme, layout preferences
  - **Advanced**: Debug options, logs

### 5.2 Configuration Management
- [ ] Store settings in database
- [ ] Create settings context/provider
- [ ] Implement real-time settings updates
- [ ] Add import/export settings

## Phase 6: Advanced Features (Priority: Medium)

### 6.1 Recording Interface
- [ ] Create recording page with:
  - WebRTC audio recording
  - Real-time waveform
  - Pause/resume support
  - Auto-save drafts
- [ ] Direct upload after recording

### 6.2 Speaker Management
- [ ] Enhanced speaker detection UI
- [ ] Speaker profile creation
- [ ] Voice fingerprinting (future)
- [ ] Speaker statistics

### 6.3 Search & Analytics
- [ ] Full-text search across transcripts
- [ ] Usage analytics dashboard
- [ ] Export reports
- [ ] API usage tracking

## Phase 7: Polish & Optimization (Priority: Low)

### 7.1 Performance
- [ ] Implement virtual scrolling for large lists
- [ ] Add caching layer (Redis)
- [ ] Optimize database queries
- [ ] Lazy load components

### 7.2 User Experience
- [ ] Add keyboard shortcuts
- [ ] Implement undo/redo for edits
- [ ] Add tooltips and help system
- [ ] Create onboarding flow

### 7.3 Mobile App Preparation
- [ ] Ensure full mobile responsiveness
- [ ] Add PWA support
- [ ] Prepare for Capacitor integration

## Technical Stack

### Frontend
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui components
- Tanstack Query for data fetching
- Zustand for state management
- WaveSurfer.js for audio

### Backend
- PostgreSQL database
- Drizzle ORM
- pg-boss job queue
- Server-Sent Events
- WhisperX (Python subprocess)

### AI/ML
- WhisperX with large-v3 model
- PyAnnote for speaker diarization
- Gemini/Claude for extraction

## Implementation Order

1. **Week 1**: Database setup, core models, migration scripts
2. **Week 2**: Dashboard UI, navigation, file management
3. **Week 3**: Transcript viewer, audio player
4. **Week 4**: AI extraction features, templates
5. **Week 5**: Settings, configuration, polish
6. **Week 6**: Testing, optimization, documentation

## Success Metrics

- [ ] Feature parity with Scriberr
- [ ] Sub-3 second page loads
- [ ] Mobile-responsive design
- [ ] 100% TypeScript coverage
- [ ] Comprehensive error handling
- [ ] Production-ready deployment

This plan ensures we deliver a premium, professional transcription platform that matches and potentially exceeds the original Scriberr implementation.