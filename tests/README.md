# E2E Test Suite for Noti Application

This directory contains comprehensive end-to-end tests for the Noti audio transcription platform, focusing on Supabase Storage integration and complete user workflows.

## Test Architecture

```
tests/
├── e2e/                    # Playwright E2E test specs
│   ├── supabase-storage.spec.ts    # Direct Supabase storage tests
│   ├── api-endpoints.spec.ts       # API integration tests
│   ├── file-upload.spec.ts         # UI file upload tests
│   ├── full-workflow.spec.ts       # Complete user journeys
│   └── telegram-integration.spec.ts # Telegram webhook tests
├── fixtures/               # Test audio files
│   ├── test-audio-small.mp3
│   ├── test-audio-medium.wav
│   ├── test-voice-message.ogg
│   └── invalid-file.txt
├── utils/                  # Test utilities and helpers
│   ├── test-helpers.ts            # Common test functions
│   ├── supabase-test-manager.ts   # Supabase test environment
│   ├── file-generators.ts         # Test file generation
│   ├── global-setup.ts            # Test environment setup
│   └── global-teardown.ts         # Test environment cleanup
└── README.md              # This file
```

## Prerequisites

### 1. Supabase Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (for testing)
supabase init
supabase start
```

### 2. Environment Variables
Create a `.env.local` file with test Supabase configuration:

```env
# Test Supabase Configuration
TEST_SUPABASE_URL=http://127.0.0.1:54321
TEST_SUPABASE_ANON_KEY=your-test-anon-key
TEST_SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key
```

### 3. Application Running
The tests expect the Next.js application to be running:
```bash
npm run dev  # Runs on http://localhost:5173
```

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Specific Test Suites
```bash
# Supabase storage integration
npm run test:e2e -- tests/e2e/supabase-storage.spec.ts

# API endpoints
npm run test:e2e -- tests/e2e/api-endpoints.spec.ts

# File upload UI
npm run test:e2e -- tests/e2e/file-upload.spec.ts

# Full workflows
npm run test:e2e -- tests/e2e/full-workflow.spec.ts

# Telegram integration
npm run test:e2e -- tests/e2e/telegram-integration.spec.ts
```

### Debug Mode
```bash
npm run test:e2e:debug    # Run with debugger
npm run test:e2e:headed   # Run with browser UI visible
npm run test:e2e:ui       # Run with Playwright UI
```

### Test Reports
```bash
npm run test:e2e:report   # View HTML test report
```

## Test Categories

### 1. Supabase Storage Tests (`supabase-storage.spec.ts`)
- **Binary integrity**: Upload/download cycle maintains file content
- **Multi-format support**: MP3, WAV, OGG file handling
- **Signed URLs**: Private bucket access URL generation
- **File operations**: Upload, download, delete, existence checks
- **Error handling**: Invalid buckets, missing files, network issues
- **Concurrency**: Multiple simultaneous uploads

### 2. API Endpoint Tests (`api-endpoints.spec.ts`)
- **POST /api/upload**: File upload with Supabase storage verification
- **GET /api/files/[id]**: File metadata retrieval
- **GET /api/files**: File listing with storage paths
- **POST /api/transcribe-simple/[id]**: Supabase download for transcription
- **GET /api/transcribe/status/[id]**: Transcription status tracking
- **File integrity**: End-to-end content verification

### 3. File Upload UI Tests (`file-upload.spec.ts`)
- **Browser upload**: File input interaction with Supabase storage
- **Drag & drop**: File drop functionality
- **Progress feedback**: Upload progress indicators
- **Multiple files**: Concurrent upload handling
- **Error handling**: Invalid file type messaging
- **Draft uploads**: Optional draft mode testing
- **Navigation**: Post-upload redirects

### 4. Full Workflow Tests (`full-workflow.spec.ts`)
- **Complete journey**: Upload → Transcription → View results
- **File management**: List, view, navigate between files
- **Location data**: Geolocation capture and storage
- **Error recovery**: Invalid file followed by valid upload
- **Transcription monitoring**: Status updates and completion
- **Cross-browser**: Multi-browser compatibility

### 5. Telegram Integration Tests (`telegram-integration.spec.ts`)
- **Voice messages**: Webhook handling with Supabase storage
- **Audio files**: File attachment processing
- **Authentication**: Secret token validation
- **Commands**: Text command processing (/start, /help, etc.)
- **Error handling**: Malformed requests, disabled integration
- **File validation**: Size limits and format checks
- **Callback queries**: Inline keyboard responses

## Test Data Management

### Test Files
- **test-audio-small.mp3**: Minimal valid MP3 (46 bytes)
- **test-audio-medium.wav**: Minimal valid WAV (46 bytes)
- **test-voice-message.ogg**: Minimal valid OGG (58 bytes)
- **invalid-file.txt**: Text file for error testing (65 bytes)

### Cleanup
- Tests automatically clean up uploaded files after completion
- Failed tests may leave test files in Supabase storage
- Manual cleanup: Check `test-audio-files` bucket for `e2e-test/` prefix files

### Isolation
- Each test uses unique file names with timestamps
- Test buckets are separate from production (`test-audio-files`, `test-transcripts`)
- Database records use test database path

## Debugging Tests

### Common Issues

1. **Supabase Connection Failed**
   ```
   Error: Supabase key is required for testing
   ```
   - Check `.env.local` has correct `TEST_SUPABASE_*` variables
   - Verify Supabase is running locally: `supabase status`

2. **Application Not Running**
   ```
   Error: connect ECONNREFUSED 127.0.0.1:5173
   ```
   - Start the Next.js app: `npm run dev`
   - Verify it's running on port 5173

3. **Test Files Not Found**
   ```
   Error: Test file not found: .../fixtures/test-audio-small.mp3
   ```
   - Regenerate test files: `node -r tsx/esm tests/utils/file-generators.ts`

4. **Database Issues**
   ```
   Error: SQLITE_IOERR_FSTAT
   ```
   - Reset test database: `rm test-e2e.db`
   - Restart application and tests

### Debug Commands
```bash
# Run single test with debug
npm run test:e2e:debug -- -g "should upload and retrieve file"

# Run with browser visible
npm run test:e2e:headed -- tests/e2e/supabase-storage.spec.ts

# Generate trace for failed tests
npm run test:e2e -- --trace on
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Setup Supabase
  run: |
    npx supabase init
    npx supabase start

- name: Run E2E Tests
  env:
    TEST_SUPABASE_URL: http://127.0.0.1:54321
    TEST_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
  run: npm run test:e2e
```

### Test Parallelization
- Tests run in parallel by default
- Use `--workers=1` for sequential execution if needed
- API tests are isolated from UI tests

## Performance Notes

- **Test Duration**: ~2-5 minutes for full suite
- **File Sizes**: Minimal test files for speed (< 100 bytes each)
- **Concurrency**: Tests use unique paths to avoid conflicts
- **Network**: Local Supabase instance recommended for speed

## Extending Tests

### Adding New Test Cases
1. Create new `.spec.ts` file in `tests/e2e/`
2. Import test helpers: `import { TestHelpers } from '../utils/test-helpers';`
3. Add cleanup in `afterAll` hook
4. Use unique file paths to avoid conflicts

### New Test Files
1. Add files to `tests/fixtures/`
2. Update `file-generators.ts` if programmatic generation needed
3. Update `TestHelpers.getTestFile()` for new file types

### Custom Utilities
1. Add helper functions to `tests/utils/test-helpers.ts`
2. Extend `SupabaseTestManager` for storage operations
3. Create domain-specific helpers in separate utility files

This comprehensive test suite ensures the Noti application's Supabase integration works correctly across all user flows and handles edge cases gracefully.