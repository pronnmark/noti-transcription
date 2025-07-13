import { NextRequest, NextResponse } from 'next/server';
import { audioFilesService } from '@/lib/db/sqliteServices';
import { fileService } from '@/lib/services/fileService';
import { parseAudioFile } from '@/lib/db/sqliteServices';

export async function GET(request: NextRequest) {
  try {
    let files;
    
    // Try SQLite database first
    try {
      const dbFiles = await audioFilesService.findAll();
      files = dbFiles.map(parseAudioFile);
    } catch (dbError) {
      console.log('SQLite database error, falling back to file storage:', dbError);
      // Fallback to file-based storage
      const fileBasedFiles = await fileService.getAllFiles();
      files = fileBasedFiles;
    }
    
    // Transform database records to match the frontend interface
    const transformedFiles = files.map(file => {
      // Handle date conversion safely with proper validation
      let createdAt = new Date().toISOString();
      let updatedAt = new Date().toISOString();
      
      // Helper function to safely convert dates
      const safeISOString = (dateValue: any): string => {
        if (!dateValue) return new Date().toISOString();
        
        try {
          if (dateValue instanceof Date) {
            // Check if date is valid
            if (isNaN(dateValue.getTime())) {
              return new Date().toISOString();
            }
            return dateValue.toISOString();
          } else if (typeof dateValue === 'string') {
            const parsed = new Date(dateValue);
            if (isNaN(parsed.getTime())) {
              return new Date().toISOString();
            }
            return parsed.toISOString();
          } else if (typeof dateValue === 'number') {
            const parsed = new Date(dateValue);
            if (isNaN(parsed.getTime())) {
              return new Date().toISOString();
            }
            return parsed.toISOString();
          }
        } catch (e) {
          console.error('Date conversion error:', e);
        }
        
        return new Date().toISOString();
      };
      
      createdAt = safeISOString(file.uploadedAt);
      updatedAt = safeISOString(file.updatedAt);
      
      return {
        id: file.id?.toString() || '0',
        filename: file.fileName || '',
        originalName: file.originalFileName || '',
        size: file.fileSize || 0,
        mimeType: file.originalFileType || '',
        createdAt,
        updatedAt,
        transcriptionStatus: file.transcriptionStatus,
        hasTranscript: file.transcriptionStatus === 'completed',
        hasAiExtract: !!file.aiExtract,
        duration: file.duration || undefined,
      };
    });
    
    return NextResponse.json({
      files: transformedFiles,
      total: transformedFiles.length
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}