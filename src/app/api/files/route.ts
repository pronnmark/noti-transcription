import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/database/client';
import { audioFiles, fileLabels } from '../../../lib/database/schema/audio';
import { transcriptionJobs } from '../../../lib/database/schema/transcripts';
import { summarizations } from '../../../lib/database/schema/system';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;
    const includeDates = searchParams.get('includeDates') === 'true';
    const dateFilter = searchParams.get('date'); // YYYY-MM-DD format

    // Build the base query
    const filesQueryBuilder = db
      .select({
        id: audioFiles.id,
        filename: audioFiles.fileName,
        originalName: audioFiles.originalFileName,
        size: audioFiles.fileSize,
        mimeType: audioFiles.originalFileType,
        createdAt: audioFiles.uploadedAt,
        updatedAt: audioFiles.updatedAt,
        recordedAt: audioFiles.recordedAt,
        duration: audioFiles.duration,
        transcriptionStatus: sql<string>`COALESCE(${transcriptionJobs.status}, 'pending')`,
        hasTranscript: sql<boolean>`CASE WHEN ${transcriptionJobs.status} = 'completed' THEN 1 ELSE 0 END`,
        speakerCount: sql<number>`COALESCE(${transcriptionJobs.speakerCount}, 0)`,
        diarizationStatus: sql<string>`COALESCE(${transcriptionJobs.diarizationStatus}, 'not_attempted')`,
        summarizationCount: sql<number>`COALESCE(COUNT(${summarizations.id}), 0)`,
        labels: sql<string[]>`COALESCE(${fileLabels.labels}, '[]')`,
      })
      .from(audioFiles)
      .leftJoin(transcriptionJobs, eq(audioFiles.id, transcriptionJobs.fileId))
      .leftJoin(summarizations, eq(audioFiles.id, summarizations.fileId))
      .leftJoin(fileLabels, eq(audioFiles.id, fileLabels.fileId));

    // Add date filtering if specified
    let whereClause = undefined;
    if (dateFilter) {
      const startOfDay = Math.floor(new Date(dateFilter + 'T00:00:00.000Z').getTime() / 1000);
      const endOfDay = Math.floor(new Date(dateFilter + 'T23:59:59.999Z').getTime() / 1000);

      whereClause = sql`(
        (${audioFiles.recordedAt} IS NOT NULL AND ${audioFiles.recordedAt} BETWEEN ${startOfDay} AND ${endOfDay})
        OR 
        (${audioFiles.recordedAt} IS NULL AND ${audioFiles.uploadedAt} BETWEEN ${startOfDay} AND ${endOfDay})
      )`;
    }

    // Execute the query
    const query = whereClause ? filesQueryBuilder.where(whereClause) : filesQueryBuilder;
    const filesQuery = await query
      .groupBy(audioFiles.id, transcriptionJobs.status, transcriptionJobs.speakerCount, transcriptionJobs.diarizationStatus, fileLabels.labels)
      .orderBy(desc(audioFiles.recordedAt), desc(audioFiles.id))
      .limit(limit)
      .offset(offset);

    // Get total count (with same date filtering)
    const baseCountQuery = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(audioFiles);

    const countQuery = whereClause ? baseCountQuery.where(whereClause) : baseCountQuery;

    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;

    // Format files for UI
    const files = filesQuery.map(file => ({
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      recordedAt: file.recordedAt,
      transcriptionStatus: file.transcriptionStatus,
      hasTranscript: Boolean(file.hasTranscript),
      hasAiExtract: file.summarizationCount > 0,
      extractCount: file.summarizationCount || 0,
      duration: file.duration || 0,
      speakerCount: file.speakerCount || 0,
      diarizationStatus: file.diarizationStatus || 'not_attempted',
      hasSpeakers: file.diarizationStatus === 'success' && (file.speakerCount || 0) > 0,
      labels: (() => {
        try {
          return typeof file.labels === 'string' ? JSON.parse(file.labels) : (Array.isArray(file.labels) ? file.labels : []);
        } catch (_e) {
          return [];
        }
      })(),
      notesStatus: 'pending',
      notesCount: 0,
    }));

    // Get recording dates if requested
    let recordingDates: string[] = [];
    if (includeDates) {
      const datesQuery = await db
        .select({
          recordedAt: audioFiles.recordedAt,
          uploadedAt: audioFiles.uploadedAt,
        })
        .from(audioFiles);

      const uniqueDates = new Set<string>();
      datesQuery.forEach(row => {
        const date = row.recordedAt || row.uploadedAt;
        if (date) {
          const dateStr = new Date(date).toISOString().split('T')[0];
          uniqueDates.add(dateStr);
        }
      });

      recordingDates = Array.from(uniqueDates).sort();
    }

    // Check if client wants grouped response
    const groupByDate = searchParams.get('groupByDate') === 'true';

    if (groupByDate) {
      // Group files by recording date (or upload date as fallback)
      if (!files || files.length === 0) {
        return NextResponse.json({
          files: [],
          groupedFiles: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          ...(includeDates && { recordingDates }),
        });
      }

      const groupedFiles = files.reduce((groups, file) => {
        if (!file || (!file.recordedAt && !file.createdAt)) {
          return groups; // Skip files without valid dates
        }

        const dateToUse = file.recordedAt || file.createdAt;
        const dateKey = new Date(dateToUse).toISOString().split('T')[0]; // YYYY-MM-DD format

        if (!groups[dateKey]) {
          groups[dateKey] = {
            date: dateKey,
            displayDate: new Date(dateKey).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            files: [],
            count: 0,
            hasTimeData: false,
          };
        }

        // Check if this file has time data (not just date)
        if (file.recordedAt) {
          const recordedDate = new Date(file.recordedAt);
          const hasTime = recordedDate.getHours() !== 0 || recordedDate.getMinutes() !== 0 || recordedDate.getSeconds() !== 0;
          if (hasTime) {
            groups[dateKey].hasTimeData = true;
          }
        }

        groups[dateKey].files.push(file);
        groups[dateKey].count++;
        return groups;
      }, {} as Record<string, any>);

      // Convert to array and sort by date (newest first)
      const groupedArray = Object.values(groupedFiles).sort((a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      return NextResponse.json({
        files,
        groupedFiles: groupedArray,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        groupedByDate: true,
        ...(includeDates && { recordingDates }),
      });
    }

    return NextResponse.json({
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      groupedByDate: false,
      ...(includeDates && { recordingDates }),
    });

  } catch (error) {
    console.error('Files API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load files',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
