import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getDb } from '../../../../lib/database/client';
import { audioFiles } from '../../../../lib/database/schema/audio';
import { transcriptionJobs } from '../../../../lib/database/schema/transcripts';
import { aiExtracts } from '../../../../lib/database/schema/extractions';
import { eq, sql } from 'drizzle-orm';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Query file with transcription status
    const fileQuery = await db
      .select({
        id: audioFiles.id,
        filename: audioFiles.fileName,
        originalName: audioFiles.originalFileName,
        size: audioFiles.fileSize,
        mimeType: audioFiles.originalFileType,
        createdAt: audioFiles.uploadedAt,
        updatedAt: audioFiles.updatedAt,
        duration: audioFiles.duration,
        transcriptionStatus: sql<string>`COALESCE(${transcriptionJobs.status}, 'pending')`,
      })
      .from(audioFiles)
      .leftJoin(transcriptionJobs, eq(audioFiles.id, transcriptionJobs.fileId))
      .where(eq(audioFiles.id, parseInt(id)))
      .limit(1);

    if (fileQuery.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 },
      );
    }

    const file = fileQuery[0];
    return NextResponse.json({
      id: file.id,
      originalFileName: file.originalName,
      fileName: file.filename,
      duration: file.duration || 0,
      uploadedAt: file.createdAt,
      transcribedAt: null,
      language: 'sv',
      modelSize: 'large-v3',
    });

  } catch (error) {
    console.error('Get file error:', error);
    return NextResponse.json(
      { error: 'Failed to get file' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { originalName } = body;

    if (!originalName || typeof originalName !== 'string') {
      return NextResponse.json(
        { error: 'Original name is required' },
        { status: 400 },
      );
    }

    const db = getDb();

    // Update the file name in database
    const updateResult = await db
      .update(audioFiles)
      .set({
        originalFileName: originalName,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(audioFiles.id, parseInt(id)));

    return NextResponse.json({
      success: true,
      message: 'File renamed successfully',
    });

  } catch (error) {
    console.error('Rename file error:', error);
    return NextResponse.json(
      { error: 'Failed to rename file' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Get file info first
    const fileQuery = await db
      .select({
        id: audioFiles.id,
        filename: audioFiles.fileName,
      })
      .from(audioFiles)
      .where(eq(audioFiles.id, parseInt(id)))
      .limit(1);

    if (fileQuery.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 },
      );
    }

    const file = fileQuery[0];

    // Delete physical files
    const audioFilesDir = join(DATA_DIR, 'audio_files');
    const transcriptsDir = join(DATA_DIR, 'transcripts');

    try {
      // Delete audio file (try both original and converted formats)
      if (file.filename) {
        const audioPath = join(audioFilesDir, file.filename);
        await fs.unlink(audioPath).catch(() => {}); // Ignore if file doesn't exist

        // Also try to delete the original uploaded file (might be different format)
        const baseName = file.filename.split('.')[0];
        const extensions = ['.m4a', '.mp3', '.wav', '.flac', '.ogg', '.webm', '.mp4'];

        for (const ext of extensions) {
          const altPath = join(audioFilesDir, baseName + ext);
          await fs.unlink(altPath).catch(() => {}); // Ignore if file doesn't exist
        }
      }

      // Delete transcript file
      const transcriptPath = join(transcriptsDir, `${id}.json`);
      await fs.unlink(transcriptPath).catch(() => {}); // Ignore if file doesn't exist

      // Delete transcript metadata file
      const metadataPath = join(transcriptsDir, `${id}_metadata.json`);
      await fs.unlink(metadataPath).catch(() => {}); // Ignore if file doesn't exist

    } catch (fileError) {
      console.error('Error deleting physical files:', fileError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database (order matters due to foreign key constraints)
    await db.delete(aiExtracts).where(eq(aiExtracts.fileId, parseInt(id)));
    await db.delete(transcriptionJobs).where(eq(transcriptionJobs.fileId, parseInt(id)));
    await db.delete(audioFiles).where(eq(audioFiles.id, parseInt(id)));

    return NextResponse.json({
      success: true,
      message: 'File and transcript deleted successfully',
    });

  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 },
    );
  }
}
