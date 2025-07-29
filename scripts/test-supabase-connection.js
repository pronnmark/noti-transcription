#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';

  console.log('Configuration:');
  console.log(`- URL: ${supabaseUrl}`);
  console.log(`- Key: ${supabaseKey ? '✓ Present' : '✗ Missing'}`);
  console.log('');

  if (!supabaseKey) {
    console.error('❌ ERROR: Supabase key is missing!');
    console.error(
      'Please set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable.'
    );
    process.exit(1);
  }

  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✓ Supabase client created successfully\n');

    // Test storage buckets
    console.log('📦 Testing Storage Buckets:');

    // List buckets
    const { data: buckets, error: bucketsError } =
      await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
    } else {
      console.log(`✓ Found ${buckets?.length || 0} buckets:`);
      buckets?.forEach(bucket => {
        console.log(
          `  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`
        );
      });
    }

    // Check specific buckets
    console.log('\n🔍 Checking required buckets:');
    const requiredBuckets = ['audio-files', 'transcripts'];

    for (const bucketName of requiredBuckets) {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1 });

      if (error) {
        if (error.message?.includes('not found')) {
          console.log(`  ❌ Bucket '${bucketName}' does not exist`);
        } else {
          console.log(`  ⚠️  Bucket '${bucketName}' error: ${error.message}`);
        }
      } else {
        console.log(`  ✓ Bucket '${bucketName}' is accessible`);
      }
    }

    console.log('\n✅ Supabase connection test completed!');
  } catch (error) {
    console.error('\n❌ Connection test failed:', error);
    process.exit(1);
  }
}

testSupabaseConnection();
