import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '../../../lib/auth';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// KISS: Simple upload that just saves the file
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

    // Step 2: Get file from form data
    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      console.error('Failed to parse form data:', e);
      return NextResponse.json({
        error: 'Failed to parse form data',
        details: e instanceof Error ? e.message : String(e),
      }, { status: 400 });
    }

    const file = formData.get('audio') as File;
    if (!file) {
      return NextResponse.json({
        error: 'No file provided',
      }, { status: 400 });
    }

    // Step 3: Validate file
    console.log('File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (file.size === 0) {
      return NextResponse.json({
        error: 'File is empty',
      }, { status: 400 });
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
      return NextResponse.json({
        error: 'File too large (max 100MB)',
      }, { status: 400 });
    }

    // Step 4: Read file buffer
    let buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
      console.log('File buffer read successfully, size:', buffer.length);
    } catch (e) {
      console.error('Failed to read file buffer:', e);
      return NextResponse.json({
        error: 'Failed to read file data',
        details: e instanceof Error ? e.message : String(e),
      }, { status: 500 });
    }

    // Step 5: Create upload directory
    const uploadDir = join(process.cwd(), 'data', 'audio_files');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      console.log('Upload directory ensured:', uploadDir);
    } catch (e) {
      console.error('Failed to create upload directory:', e);
      return NextResponse.json({
        error: 'Failed to create upload directory',
        details: e instanceof Error ? e.message : String(e),
      }, { status: 500 });
    }

    // Step 6: Save file
    const fileName = `${uuidv4()}_${file.name}`;
    const filePath = join(uploadDir, fileName);

    try {
      await fs.writeFile(filePath, buffer);
      console.log('File saved successfully:', filePath);
    } catch (e) {
      console.error('Failed to save file:', e);
      return NextResponse.json({
        error: 'Failed to save file',
        details: e instanceof Error ? e.message : String(e),
      }, { status: 500 });
    }

    // Step 7: Return success
    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully (simple mode)',
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        savedAs: fileName,
        path: filePath,
      },
      executionTime,
    });

  } catch (error) {
    console.error('Unexpected error in simple upload:', error);
    return NextResponse.json({
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
