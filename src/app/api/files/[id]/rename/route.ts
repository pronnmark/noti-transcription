import { NextRequest, NextResponse } from 'next/server';
import { getAudioRepository, getTranscriptionRepository, getErrorHandlingService } from '@/lib/di/containerSetup';
import { fileRenamingService, FileRenamingError } from '@/lib/services/FileRenamingService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const errorHandler = getErrorHandlingService();
  const operation = 'POST /api/files/[id]/rename';

  return await errorHandler.handleAsync(operation, async () => {
    const { id } = await params;
    
    // Validate ID
    const { id: fileId, error } = errorHandler.extractAndValidateId([id], 'File ID');
    if (error) return error;

    // Get repositories
    const audioRepository = getAudioRepository();
    const transcriptionRepository = getTranscriptionRepository();

    // Get the file
    const audioFile = await audioRepository.findById(fileId);
    if (!audioFile) {
      return errorHandler.handleNotFoundError('Audio file', fileId, operation);
    }

    // Get the latest transcription
    const transcription = await transcriptionRepository.findLatestByFileId(fileId);
    if (!transcription || !transcription.transcript_text) {
      return NextResponse.json(
        { 
          error: 'No transcript available for this file. Cannot generate filename.',
          errorCode: 'NO_TRANSCRIPT',
          success: false
        },
        { status: 400 }
      );
    }

    // Parse request body for enhanced options
    let renameOptions = {};
    let context = {};
    try {
      const body = await request.json();
      renameOptions = body.options || {};
      context = {
        fileId: fileId.toString(),
        userId: body.userId || 'anonymous', // In production, extract from auth
        metadata: {
          originalFileSize: audioFile.file_size, 
          transcriptionDuration: transcription.duration_seconds,
          ...body.metadata
        }
      };
    } catch {
      // Use default options if no body or invalid JSON
      context = { fileId: fileId.toString(), userId: 'anonymous' };
    }

    // Check for filename conflicts before generating
    const duplicateCheck = await audioRepository.checkForDuplicates({
      fileHash: '', // Not used for this check
      fileSize: 0,  // Not used for this check
      originalFileName: audioFile.original_file_name,
    });
    if (duplicateCheck.length > 1) {
      console.log(`[Rename] Found ${duplicateCheck.length} files with same name: ${audioFile.original_file_name}`);
    }

    // Generate new filename with enhanced service
    const result = await fileRenamingService.generateFilename(
      transcription.transcript_text,
      audioFile.original_file_name,
      renameOptions,
      context
    );

    // Enhanced error handling
    if (!result.success) {
      const statusCode = result.errorCode === 'RATE_LIMIT_EXCEEDED' ? 429 :
                        result.errorCode === 'TRANSCRIPT_TOO_SHORT' ? 400 :
                        result.errorCode === 'AI_SERVICE_UNAVAILABLE' ? 503 :
                        result.errorCode === 'AUTH_ERROR' ? 503 : 400;

      return NextResponse.json(
        { 
          error: result.error || 'Failed to generate filename',
          errorCode: result.errorCode,
          success: false,
          processingTime: result.processingTime,
          originalName: result.originalName
        },
        { status: statusCode }
      );
    }

    // Check for filename conflicts with the generated name
    const conflictCheck = await audioRepository.checkForDuplicates({
      fileHash: '',
      fileSize: 0,
      originalFileName: result.suggestedName,
    });
    let finalName = result.suggestedName;
    
    if (conflictCheck.length > 0 && !renameOptions.forceOverwrite) {
      // Generate unique name by appending number
      const baseName = finalName.replace(/\.[^/.]+$/, ''); // Remove extension
      const extension = finalName.match(/\.[^/.]+$/)?.[0] || '';
      let counter = 1;
      
      do {
        finalName = `${baseName}_${counter}${extension}`;
        const checkConflict = await audioRepository.checkForDuplicates({
          fileHash: '',
          fileSize: 0,
          originalFileName: finalName,
        });
        if (checkConflict.length === 0) break;
        counter++;
      } while (counter <= 100); // Prevent infinite loop
      
      console.log(`[Rename] Resolved filename conflict: ${result.suggestedName} → ${finalName}`);
    }

    // Update the file in database
    try {
      await audioRepository.update(fileId, {
        original_file_name: finalName,
        updated_at: new Date(),
      });

      // Return enhanced response
      return NextResponse.json({
        success: true,
        originalName: result.originalName,
        newName: finalName,
        suggestedName: result.suggestedName, // Original AI suggestion
        wasRenamed: finalName !== result.suggestedName, // Was modified due to conflicts
        confidence: result.confidence,
        reasoning: result.reasoning,
        alternativeNames: result.alternativeNames,
        processingTime: result.processingTime,
        fileId: fileId,
        metadata: {
          cacheHit: result.processingTime && result.processingTime < 100, // Likely cache hit
          hasConflicts: conflictCheck.length > 0,
          transcriptLength: transcription.transcript_text.length,
        }
      });
    } catch (error) {
      console.error('Failed to update filename in database:', error);
      return NextResponse.json(
        { 
          error: 'Failed to update filename in database',
          errorCode: 'DATABASE_ERROR',
          success: false,
          processingTime: result.processingTime,
          // Still return the generated name for debugging
          suggestedName: finalName,
          originalName: result.originalName
        },
        { status: 500 }
      );
    }
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const errorHandler = getErrorHandlingService();
  const operation = 'GET /api/files/[id]/rename';

  return await errorHandler.handleAsync(operation, async () => {
    const { id } = await params;
    
    // Validate ID
    const { id: fileId, error } = errorHandler.extractAndValidateId([id], 'File ID');
    if (error) return error;

    // Get repositories
    const audioRepository = getAudioRepository();
    const transcriptionRepository = getTranscriptionRepository();

    // Get the file
    const audioFile = await audioRepository.findById(fileId);
    if (!audioFile) {
      return errorHandler.handleNotFoundError('Audio file', fileId, operation);
    }

    // Get the latest transcription
    const transcription = await transcriptionRepository.findLatestByFileId(fileId);
    if (!transcription || !transcription.transcript_text) {
      return NextResponse.json(
        { 
          error: 'No transcript available for this file. Cannot generate filename suggestions.',
          errorCode: 'NO_TRANSCRIPT',
          canRename: false,
          success: false
        },
        { status: 400 }
      );
    }

    // Parse query parameters for enhanced options
    const url = new URL(request.url);
    const count = Math.min(parseInt(url.searchParams.get('suggestions') || '3'), 5);
    const maxLength = parseInt(url.searchParams.get('maxLength') || '60');
    const includeDatePrefix = url.searchParams.get('includeDate') === 'true';
    const category = url.searchParams.get('category') || undefined;

    // Create context for suggestions
    const context = {
      fileId: fileId.toString(),
      userId: 'anonymous', // In production, extract from auth
      metadata: {
        originalFileSize: audioFile.file_size,
        transcriptionDuration: transcription.duration_seconds,
      }
    };

    try {
      // Generate enhanced suggestions using the improved service
      const result = await fileRenamingService.generateFilename(
        transcription.transcript_text,
        audioFile.original_file_name,
        {
          maxLength,
          includeDatePrefix,
          includeFileExtension: true,
          generateAlternatives: count > 1,
          maxAlternatives: count - 1,
          category,
        },
        context
      );

      if (!result.success) {
        return NextResponse.json(
          { 
            error: result.error || 'Failed to generate suggestions',
            errorCode: result.errorCode,
            canRename: false,
            success: false,
            processingTime: result.processingTime
          },
          { status: 400 }
        );
      }

      // Build suggestions array
      const suggestions = [result.suggestedName];
      if (result.alternativeNames) {
        suggestions.push(...result.alternativeNames);
      }

      return NextResponse.json({
        success: true,
        currentName: audioFile.original_file_name,
        suggestions: suggestions.slice(0, count),
        primarySuggestion: {
          name: result.suggestedName,
          confidence: result.confidence,
          reasoning: result.reasoning,
        },
        canRename: suggestions.length > 0,
        fileId: fileId,
        processingTime: result.processingTime,
        metadata: {
          transcriptLength: transcription.transcript_text.length,
          cacheHit: result.processingTime && result.processingTime < 100,
          confidenceScore: result.confidence,
        }
      });
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      return NextResponse.json(
        { 
          error: 'Failed to generate filename suggestions',
          errorCode: 'GENERATION_FAILED',
          canRename: false,
          success: false
        },
        { status: 500 }
      );
    }
  });
}