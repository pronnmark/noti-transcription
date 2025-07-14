import { NextRequest, NextResponse } from 'next/server';
import { audioFilesService, parseAudioFile } from '@/lib/db/sqliteServices';
import { getAudioFile, deleteAudioFile, updateAudioFile } from '@/lib/fileDb';
import { promises as fs } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Try to get file from database
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      const file = await audioFilesService.findById(numericId);
      if (file) {
        const parsedFile = parseAudioFile(file);
        return NextResponse.json({
          id: parsedFile.id.toString(),
          originalFileName: parsedFile.originalFileName,
          fileName: parsedFile.fileName,
          duration: parsedFile.duration,
          uploadedAt: parsedFile.uploadedAt instanceof Date && !isNaN(parsedFile.uploadedAt.getTime()) 
            ? parsedFile.uploadedAt.toISOString() 
            : new Date().toISOString(),
          transcribedAt: parsedFile.transcribedAt instanceof Date && !isNaN(parsedFile.transcribedAt.getTime())
            ? parsedFile.transcribedAt.toISOString() 
            : null,
          language: parsedFile.language || 'sv',
          modelSize: parsedFile.modelSize || 'large-v3',
        });
      }
    }
    
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Get file error:', error);
    return NextResponse.json(
      { error: 'Failed to get file' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { originalName } = body;

    if (!originalName || typeof originalName !== 'string') {
      return NextResponse.json(
        { error: 'Original name is required' },
        { status: 400 }
      );
    }

    // First try file-based approach (UUID format)
    const fileBasedFile = await getAudioFile(id);
    if (fileBasedFile) {
      await updateAudioFile(id, { originalName });
      return NextResponse.json({
        success: true,
        message: 'File renamed successfully'
      });
    }
    
    // Then try SQLite approach (numeric ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      const file = await audioFilesService.findById(numericId);
      if (!file) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }

      await audioFilesService.update(numericId, { originalFileName: originalName });
      return NextResponse.json({
        success: true,
        message: 'File renamed successfully'
      });
    }
    
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
    
  } catch (error) {
    console.error('Rename file error:', error);
    return NextResponse.json(
      { error: 'Failed to rename file' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // First try file-based approach (UUID format)
    const fileBasedFile = await getAudioFile(id);
    if (fileBasedFile) {
      await deleteAudioFile(id);
      return NextResponse.json({
        success: true,
        message: 'File and transcript deleted successfully'
      });
    }
    
    // Then try SQLite approach (numeric ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      // Get file info before deleting
      const file = await audioFilesService.findById(numericId);
      if (!file) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }

      // Delete physical files
      const audioFilesDir = join(DATA_DIR, 'audio_files');
      const transcriptsDir = join(DATA_DIR, 'transcripts');
      
      try {
        // Delete audio file (try both original and converted formats)
        if (file.fileName) {
          const audioPath = join(audioFilesDir, file.fileName);
          await fs.unlink(audioPath).catch(() => {}); // Ignore if file doesn't exist
          
          // Also try to delete the original uploaded file (might be different format)
          const baseName = file.fileName.split('.')[0];
          const extensions = ['.m4a', '.mp3', '.wav', '.flac', '.ogg'];
          
          for (const ext of extensions) {
            const altPath = join(audioFilesDir, baseName + ext);
            await fs.unlink(altPath).catch(() => {}); // Ignore if file doesn't exist
          }
        }
        
        // Delete transcript file
        const transcriptPath = join(transcriptsDir, `${numericId}.json`);
        await fs.unlink(transcriptPath).catch(() => {}); // Ignore if file doesn't exist
        
      } catch (fileError) {
        console.error('Error deleting physical files:', fileError);
        // Continue with database deletion even if file deletion fails
      }

      // Delete from database
      const deleted = await audioFilesService.delete(numericId);
      
      if (!deleted) {
        return NextResponse.json(
          { error: 'Failed to delete file from database' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'File and transcript deleted successfully'
      });
    }
    
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
    
  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}