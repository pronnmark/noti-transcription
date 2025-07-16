import { NextRequest, NextResponse } from 'next/server';
import { audioFilesService } from '@/lib/db/sqliteServices';
import { fileService } from '@/lib/services/fileService';
import { HashService } from '@/lib/services/hashService';
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
    const speakerCountParam = formData.get('speakerCount') as string;
    const isDraftParam = formData.get('isDraft') as string;
    const allowDuplicatesParam = formData.get('allowDuplicates') as string;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Parse speaker count, default to undefined if not provided or invalid
    const speakerCount = speakerCountParam ? parseInt(speakerCountParam) : undefined;
    if (speakerCount && (speakerCount < 1 || speakerCount > 10)) {
      return NextResponse.json(
        { error: 'Speaker count must be between 1 and 10' },
        { status: 400 }
      );
    }
    
    // Check if this is a draft recording (no transcription needed)
    const isDraft = isDraftParam === 'true';
    const allowDuplicates = allowDuplicatesParam === 'true';
    
    // More flexible file type validation - handle codec parameters
    const validTypes = [
      'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 
      'audio/webm', 'audio/ogg', 'audio/m4a', 'audio/x-m4a',
      'audio/flac', 'audio/x-flac', 'audio/aac', 'audio/x-aac'
    ];
    
    // Check file extension if MIME type is not recognized
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['mp3', 'wav', 'm4a', 'mp4', 'webm', 'ogg', 'flac', 'aac'];
    
    // Extract base MIME type without codec parameters (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const baseMimeType = file.type.split(';')[0].trim();
    
    const isValidType = validTypes.includes(baseMimeType) || 
                       validTypes.includes(file.type) ||
                       (file.type === 'application/octet-stream' && validExtensions.includes(fileExtension || ''));
    
    if (!isValidType) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Please upload an audio file (${validExtensions.join(', ')})` },
        { status: 400 }
      );
    }
    
    // Read file buffer first for hash generation
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate file hash for duplicate detection
    const fileHash = HashService.generateHash(buffer);
    
    // Check for duplicates unless explicitly allowed
    if (!allowDuplicates) {
      const duplicateCheck = await audioFilesService.checkForDuplicates({
        fileHash,
        originalFileName: file.name,
        fileSize: file.size
      });
      
      if (duplicateCheck.isDuplicate) {
        return NextResponse.json({
          error: 'Duplicate file detected',
          duplicateType: duplicateCheck.duplicateType,
          message: duplicateCheck.message,
          existingFile: {
            id: duplicateCheck.existingFile?.id,
            originalFileName: duplicateCheck.existingFile?.originalFileName,
            uploadedAt: duplicateCheck.existingFile?.uploadedAt,
            transcriptionStatus: duplicateCheck.existingFile?.transcriptionStatus,
            duration: duplicateCheck.existingFile?.duration
          }
        }, { status: 409 }); // 409 Conflict for duplicates
      }
    }
    
    // Create unique filename
    const fileName = `${uuidv4()}.${fileExtension || 'mp3'}`;
    
    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'data', 'audio_files');
    await fs.mkdir(uploadDir, { recursive: true });
    console.log('Upload directory:', uploadDir);
    
    // Save file to disk
    const filePath = join(uploadDir, fileName);
    
    console.log('Uploading file:', {
      fileName,
      originalName: file.name,
      type: file.type,
      size: file.size,
      bufferSize: buffer.length,
      fileHash,
      filePath
    });
    
    await fs.writeFile(filePath, buffer);
    console.log('File saved successfully:', filePath);
    
    // Extract duration using ffprobe
    let duration = 0;
    try {
      const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`);
      duration = Math.round(parseFloat(stdout.trim()) || 0);
      console.log('Extracted duration:', duration, 'seconds');
    } catch (error) {
      console.warn('Failed to extract duration:', error);
      // Duration will remain 0 if extraction fails
    }
    
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
        fileHash,
        transcriptionStatus: (isDraft ? 'draft' : 'pending') as any,
        duration,
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
        duration,
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
    
    // Start transcription in background (don't await) - unless it's a draft
    if (!isDraft) {
      const fileId = useDatabase ? audioFile.id : audioFile.id?.toString() || fileName;
      startTranscription(fileId as any, wavPath, speakerCount).catch(error => {
        console.error('Background transcription error:', error);
      });
    }
    
    const fileId = useDatabase ? audioFile.id : audioFile.id?.toString() || fileName;
    
    return NextResponse.json({
      success: true,
      fileId: fileId,
      message: isDraft 
        ? 'Draft recording saved successfully' 
        : 'File uploaded successfully, transcription started',
      isDraft
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // More specific error handling
    let errorMessage = 'Upload failed';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        errorMessage = 'Directory creation failed';
      } else if (error.message.includes('EACCES')) {
        errorMessage = 'Permission denied - cannot write to upload directory';
      } else if (error.message.includes('ENOSPC')) {
        errorMessage = 'Insufficient disk space';
      } else if (error.message.includes('EMFILE')) {
        errorMessage = 'Too many open files';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: statusCode }
    );
  }
}

// Next.js 13+ doesn't use this config format anymore
// File size limits are handled by the server configuration