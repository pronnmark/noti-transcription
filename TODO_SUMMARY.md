# TODO Summary - Noti Project

## Overview

This document summarizes all TODOs, FIXMEs, and unfinished work found in the codebase as of
2025-07-29.

## Critical Issues (Database Schema Missing)

### 1. Missing Database Tables

Several features are completely stubbed out because their database tables don't exist in Supabase
yet:

#### Data Points Feature

- **Files**:
  - `/src/app/api/data-points/route.ts`
  - `/src/app/api/data-points/templates/route.ts`
- **Status**: Returns 501 Not Implemented
- **Needed**: `data_points` and `data_point_templates` tables

#### Extractions Feature

- **Files**:
  - `/src/app/api/extractions/route.ts`
  - `/src/app/api/extractions/templates/route.ts`
  - `/src/lib/database/repositories/ExtractionRepository.ts`
- **Status**: Returns 501 Not Implemented, repository methods return null/false
- **Needed**: `extractions` and `extraction_templates` tables

#### Summarization Templates

- **Files**:
  - `/src/lib/database/repositories/TemplateRepository.ts`
  - `/src/lib/database/repositories/SummarizationRepository.ts`
- **Status**: Repository methods stubbed with console warnings
- **Needed**: `summarization_templates` table (partial implementation exists)

## Important TODOs

### 2. Authentication & Context

- **File**: `/src/lib/middleware/AuthMiddleware.ts:50`
- **TODO**: Add user info to context
- **Impact**: User context not available in authenticated requests

### 3. AI Processing Validations

- **File**: `/src/app/api/ai/dynamic-process/[fileId]/route.ts`
- **TODOs**:
  - Line 39: Re-implement validation once SummarizationTemplateRepository has findById method
  - Lines 101, 202, 249, 276: Re-implement updateTimestamp method in repository
- **Impact**: Validation and timestamp updates are commented out

### 4. Telegram Integration

- **File**: `/src/lib/services/telegram-notification-worker.ts`
- **TODOs**:
  - Lines 87, 122: Add telegram metadata storage to jobs or files
  - Lines 148, 172: Re-enable when telegram metadata storage is implemented in schema
- **Impact**: Telegram notifications are disabled

### 5. Test Infrastructure

- **File**: `/tests/utils/test-helpers.ts:28`
- **TODO**: Add database migration setup - currently run manually
- **Impact**: Tests require manual database setup

## Notes & Warnings

### 6. Worker Endpoint Security

- **File**: `/src/app/api/worker/transcribe/route.ts:6`
- **NOTE**: This endpoint bypasses auth for testing purposes
- **Risk**: Security vulnerability if deployed to production

## Stub Implementations

### 7. Repository Methods

The following repository methods are stubbed and return empty/null values:

- `ExtractionRepository.findById()` - returns null
- `ExtractionRepository.delete()` - returns false
- `ExtractionRepository.update()` - returns null
- `ExtractionRepository.findByFileAndTemplate()` - returns []
- `ExtractionRepository.findByFileId()` - returns []
- `SummarizationRepository.findActiveByIds()` - returns []
- `SummarizationTemplateRepository.findActiveByIds()` - returns []

### 8. Placeholder Values

- **File**: `/src/app/api/real-time/process-chunk/route.ts:83`
- **Issue**: Using placeholder transcription text
- **File**: `/src/app/api/transcribe-simple/[id]/route.ts:214`
- **Issue**: Using placeholder transcription with note about installing whisper

## Priority Recommendations

### High Priority

1. **Add missing database tables** for extractions and data points features
2. **Secure the worker endpoint** that bypasses authentication
3. **Implement proper repository methods** instead of stubs

### Medium Priority

4. Complete the summarization template repository implementation
5. Add user context to authenticated requests
6. Re-enable AI processing validations

### Low Priority

7. Add Telegram metadata storage (feature currently disabled)
8. Automate test database migrations
9. Replace placeholder transcriptions with real implementations

## Migration Status

The codebase has been migrated from Drizzle ORM to Supabase, but several features couldn't be fully
migrated due to missing database schema. These features are currently non-functional and return
appropriate error responses.
