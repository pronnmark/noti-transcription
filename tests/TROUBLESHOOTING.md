# E2E Test Troubleshooting Guide

## 🔧 **Current Issue: RLS Policy Violation**

### **Symptoms**

```
Error: Supabase upload failed: new row violates row-level security policy
```

### **Root Cause**

Supabase has Row-Level Security (RLS) enabled which prevents anonymous uploads to storage buckets.

### **Solutions**

#### **Option 1: Disable RLS for Testing (Recommended)**

```sql
-- Connect to Supabase and run these SQL commands:
-- Disable RLS on storage.objects table for testing
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Or create a permissive policy for testing
CREATE POLICY "Allow all operations for testing" ON storage.objects
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);
```

#### **Option 2: Configure RLS Policies for Test Buckets**

```sql
-- Create specific policies for test buckets
CREATE POLICY "Allow test bucket access" ON storage.objects
FOR ALL TO anon, authenticated
USING (bucket_id IN ('test-audio-files', 'test-transcripts'))
WITH CHECK (bucket_id IN ('test-audio-files', 'test-transcripts'));
```

#### **Option 3: Use Service Role Key**

Already implemented in the code - tests use `SUPABASE_SERVICE_ROLE_KEY` which should bypass RLS.

### **Quick Fix Commands**

```bash
# 1. Connect to Supabase SQL editor at http://127.0.0.1:54323
# 2. Run this SQL command:
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

# 3. Run tests again:
npm run test:e2e
```

## 🚨 **Common Issues & Solutions**

### **Issue 1: Missing Environment Variables**

```
Error: Missing required Supabase environment variables
```

**Solution:**

```bash
# Check if .env.local exists and has correct keys
cat .env.local | grep SUPABASE

# If missing, copy from Supabase status:
supabase status
```

### **Issue 2: Supabase Not Running**

```
Error: connect ECONNREFUSED 127.0.0.1:54321
```

**Solution:**

```bash
# Start Supabase locally:
supabase start

# Check status:
supabase status
```

### **Issue 3: Application Not Running**

```
Error: connect ECONNREFUSED 127.0.0.1:5173
```

**Solution:**

```bash
# Start the Next.js app:
npm run dev

# Verify it's running:
curl http://localhost:5173
```

### **Issue 4: Test Files Not Found**

```
Error: Test file not found: .../fixtures/test-audio-small.mp3
```

**Solution:**

```bash
# Regenerate test files:
node -r tsx/esm tests/utils/file-generators.ts

# Verify files exist:
ls -la tests/fixtures/
```

### **Issue 5: Database Locked**

```
Error: database is locked
```

**Solution:**

```bash
# Remove test database and restart:
rm test-e2e.db*
npm run test:e2e
```

### **Issue 6: Playwright Browsers Missing**

```
Error: browserType.launch: Executable doesn't exist
```

**Solution:**

```bash
# Install Playwright browsers:
npx playwright install
```

## 🔍 **Debugging Commands**

### **Environment Check**

```bash
# Check all environment variables:
echo "SUPABASE_URL: $SUPABASE_URL"
echo "TEST_SUPABASE_URL: $TEST_SUPABASE_URL"
env | grep SUPABASE

# Test Supabase connection:
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     http://127.0.0.1:54321/storage/v1/bucket
```

### **Test Specific Issues**

```bash
# Run single test with debug:
npm run test:e2e:debug -- -g "should upload and retrieve file"

# Run with browser visible:
npm run test:e2e:headed -- tests/e2e/supabase-storage.spec.ts

# Check test files:
ls -la tests/fixtures/
file tests/fixtures/test-audio-small.mp3
```

### **Service Status Check**

```bash
# Check all required services:
echo "Supabase Status:"
supabase status

echo "Next.js App Status:"
curl -s http://localhost:5173 > /dev/null && echo "✅ Running" || echo "❌ Not running"

echo "Test Buckets:"
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     http://127.0.0.1:54321/storage/v1/bucket
```

## 📝 **Test Environment Setup Checklist**

### **Required Prerequisites**

- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Supabase running locally (`supabase start`)
- [ ] Next.js app running (`npm run dev`)
- [ ] Environment variables configured (`.env.local`)
- [ ] Playwright browsers installed (`npx playwright install`)
- [ ] Test fixtures generated (`node -r tsx/esm tests/utils/file-generators.ts`)

### **RLS Configuration**

- [ ] Storage RLS disabled for testing OR
- [ ] Proper RLS policies configured OR
- [ ] Service role key configured (done automatically)

### **Verification Steps**

- [ ] `supabase status` shows all services running
- [ ] `curl http://localhost:5173` returns HTML
- [ ] `ls tests/fixtures/` shows 4 test files
- [ ] Environment variables are loaded correctly

## 🎯 **Running Tests Successfully**

### **Full Test Suite**

```bash
# After fixing RLS issue:
npm run test:e2e
```

### **Individual Test Suites**

```bash
# Supabase storage tests:
npm run test:e2e -- tests/e2e/supabase-storage.spec.ts

# API integration tests:
npm run test:e2e -- tests/e2e/api-endpoints.spec.ts

# UI interaction tests:
npm run test:e2e -- tests/e2e/file-upload.spec.ts

# Complete workflows:
npm run test:e2e -- tests/e2e/full-workflow.spec.ts

# Telegram integration:
npm run test:e2e -- tests/e2e/telegram-integration.spec.ts
```

### **Debug Mode**

```bash
# Run with browser UI visible:
npm run test:e2e:headed

# Run with Playwright debug UI:
npm run test:e2e:ui

# Debug specific test:
npm run test:e2e:debug -- -g "binary integrity"
```

## 📊 **Expected Test Results**

Once RLS is properly configured, you should see:

- ✅ **44 test cases** across 5 test suites
- ✅ **File upload/download integrity** verified
- ✅ **Multi-format support** (MP3, WAV, OGG)
- ✅ **API integration** working correctly
- ✅ **UI interactions** functional
- ✅ **Error scenarios** handled gracefully

The test suite provides comprehensive validation that your Supabase Storage integration works
correctly across all application workflows.
