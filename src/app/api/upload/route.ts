import { NextRequest, NextResponse } from 'next/server';
import { audioFilesService } from '@/lib/db/sqliteServices';
import { fileService } from '@/lib/services/fileService';
import { startTranscription } from '@/lib/transcription';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Invalid content type. Expected multipart/form-data' },
        { status: 400 }
      );
    }
    
    const formData = await request.formData();
    const file = formData.get('audio') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // More flexible file type validation
    const validTypes = [
      'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 
      'audio/webm', 'audio/ogg', 'audio/m4a', 'audio/x-m4a',
      'audio/flac', 'audio/x-flac', 'audio/aac', 'audio/x-aac'
    ];
    
    // Check file extension if MIME type is not recognized
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['mp3', 'wav', 'm4a', 'mp4', 'webm', 'ogg', 'flac', 'aac'];
    
    const isValidType = validTypes.includes(file.type) || 
                       (file.type === 'application/octet-stream' && validExtensions.includes(fileExtension || ''));
    
    if (!isValidType) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Please upload an audio file (${validExtensions.join(', ')})` },
        { status: 400 }
      );
    }
    
    // Create unique filename
    const fileName = `${uuidv4()}.${fileExtension || 'mp3'}`;
    
    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'data', 'audio_files');
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Save file to disk
    const filePath = join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    
    // Create database record or file record
    let audioFile;
    let useDatabase = true;
    
    try {
      // Try to use database
      audioFile = await audioFilesService.create({
        fileName,
        originalFileName: file.name,
        originalFileType: file.type || 'audio/mpeg',
        fileSize: file.size,
        transcriptionStatus: 'pending',
      });
    } catch (dbError) {
      console.log('Database not available, using file storage');
      useDatabase = false;
      // Fallback to file storage
      audioFile = await fileService.createFile({
        fileName,
        originalFileName: file.name,
        originalFileType: file.type || 'audio/mpeg',
        fileSize: file.size,
      });
    }
    
    // Convert to WAV for transcription if needed
    let wavPath = filePath;
    if (!filePath.endsWith('.wav')) {
      wavPath = filePath.replace(/\.[^/.]+$/, '.wav');
      console.log(`Converting ${filePath} to WAV format...`);
      
      try {
        await execAsync(
          `ffmpeg -i "${filePath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y`
        );
      } catch (ffmpegError) {
        console.error('FFmpeg conversion error:', ffmpegError);
        // Continue anyway, the transcription might handle the original format
      }
    }
    
    // Start transcription in background (don't await)
    const fileId = useDatabase ? audioFile.id : audioFile.id?.toString() || fileName;
    startTranscription(fileId as any, wavPath).catch(error => {
      console.error('Background transcription error:', error);
    });
    
    return NextResponse.json({
      success: true,
      fileId: fileId,
      message: 'File uploaded successfully, transcription started'
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Next.js 13+ doesn't use this config format anymore
// File size limits are handled by the server configuration