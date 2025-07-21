import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { validateSession } from '../../../lib/auth';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../lib/database/client';
import { audioFiles } from '../../../lib/database/schema/audio';

// Ultra simple upload - no services, no complexity
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // 1. Check auth
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!await validateSession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get file
    const formData = await request.formData();
    const file = formData.get('audio') as File;
    
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 3. Save file
    const uploadDir = join(process.cwd(), 'data', 'audio_files');
    await fs.mkdir(uploadDir, { recursive: true });
    
    const fileName = `${uuidv4()}_${file.name}`;
    const filePath = join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // 4. Save to database
    const db = getDb();
    const [record] = await db.insert(audioFiles).values({
      fileName: fileName,
      originalFileName: file.name,
      originalFileType: file.type || 'audio/mpeg',
      fileSize: file.size,
      fileHash: uuidv4(), // Simple unique ID instead of hash
      duration: 0
    }).returning();

    // 5. Return success
    return NextResponse.json({
      success: true,
      file: {
        id: record.id,
        transcriptionStatus: 'pending',
        message: 'File uploaded successfully',
        isDraft: false,
        duration: 0
      }
    });

  } catch (error: any) {
    console.error('Ultra simple upload error:', error);
    return NextResponse.json({
      success: false,
      error: {
        message: error.message || 'Upload failed',
        type: error.constructor.name,
        code: error.code || 'UNKNOWN'
      }
    }, { status: 500 });
  }
}