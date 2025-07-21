import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '../../../lib/auth';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../lib/database/client';
import { audioFiles } from '../../../lib/database/schema/audio';

// Test upload with database operations
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Step 1: Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    const isValid = await validateSession(token);

    if (!isValid) {
      return NextResponse.json({
        error: 'Authentication required',
      }, { status: 401 });
    }

    // Step 2: Get file
    const formData = await request.formData();
    const file = formData.get('audio') as File;

    if (!file || file.size === 0) {
      return NextResponse.json({
        error: 'No file provided or file is empty',
      }, { status: 400 });
    }

    console.log('Processing file:', file.name, file.size, file.type);

    // Step 3: Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Step 4: Create simple hash (simplified version)
    const crypto = require('crypto');
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    console.log('File hash:', fileHash);

    // Step 5: Save file
    const uploadDir = join(process.cwd(), 'data', 'audio_files');
    await fs.mkdir(uploadDir, { recursive: true });

    const fileName = `${uuidv4()}_${file.name}`;
    const filePath = join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);
    console.log('File saved:', filePath);

    // Step 6: Test database insert
    let dbResult;
    try {
      const db = getDb();
      console.log('Got database instance');

      // Insert into audio_files table
      const insertData = {
        fileName: fileName,
        originalFileName: file.name,
        originalFileType: file.type || 'audio/mpeg',
        fileSize: file.size,
        fileHash: fileHash,
        duration: 0, // We'll set this to 0 for now
      };

      console.log('Inserting into database:', insertData);

      dbResult = await db.insert(audioFiles).values(insertData).returning();

      console.log('Database insert successful:', dbResult);
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Clean up file if database insert fails
      try {
        await fs.unlink(filePath);
      } catch (e) {
        console.error('Failed to clean up file:', e);
      }

      return NextResponse.json({
        error: 'Database operation failed',
        details: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
      }, { status: 500 });
    }

    // Step 7: Return success
    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'File uploaded with database record',
      file: {
        id: dbResult[0].id,
        name: file.name,
        size: file.size,
        type: file.type,
        savedAs: fileName,
        hash: fileHash,
        dbRecord: dbResult[0],
      },
      executionTime,
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
