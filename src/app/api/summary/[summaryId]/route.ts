import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/database/client';
import { audioFiles } from '../../../../lib/database/schema/audio';
import { summarizations, summarizationPrompts } from '../../../../lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ summaryId: string }> },
) {
  try {
    const { summaryId } = await params;
    const db = getDb();

    // Get the specific summary with related file and template info
    const summaryResults = await db
      .select({
        // Summary fields
        id: summarizations.id,
        content: summarizations.content,
        model: summarizations.model,
        prompt: summarizations.prompt,
        createdAt: summarizations.createdAt,
        updatedAt: summarizations.updatedAt,
        fileId: summarizations.fileId,
        templateId: summarizations.templateId,

        // File fields
        fileName: audioFiles.fileName,
        originalFileName: audioFiles.originalFileName,

        // Template fields
        templateName: summarizationPrompts.name,
        templateDescription: summarizationPrompts.description,
        templateIsDefault: summarizationPrompts.isDefault,
      })
      .from(summarizations)
      .innerJoin(audioFiles, eq(summarizations.fileId, audioFiles.id))
      .leftJoin(summarizationPrompts, eq(summarizations.templateId, summarizationPrompts.id))
      .where(eq(summarizations.id, summaryId))
      .limit(1);

    if (!summaryResults.length) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    const result = summaryResults[0];

    // Format the response
    const summary = {
      id: result.id,
      content: result.content,
      model: result.model,
      prompt: result.prompt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      file: {
        id: result.fileId,
        fileName: result.fileName,
        originalFileName: result.originalFileName,
      },
      template: result.templateId ? {
        id: result.templateId,
        name: result.templateName,
        description: result.templateDescription,
        isDefault: result.templateIsDefault,
      } : null,
    };

    return NextResponse.json({
      summary,
      success: true,
    });

  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ summaryId: string }> },
) {
  try {
    const { summaryId } = await params;
    const db = getDb();

    // First check if the summary exists
    const existingSummary = await db
      .select({ id: summarizations.id })
      .from(summarizations)
      .where(eq(summarizations.id, summaryId))
      .limit(1);

    if (!existingSummary.length) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    // Delete the summary
    await db
      .delete(summarizations)
      .where(eq(summarizations.id, summaryId));

    return NextResponse.json({
      success: true,
      message: 'Summary deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting summary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
