import { NextRequest, NextResponse } from 'next/server';
import { db, speakerLabels } from '@/lib/database';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Get speaker labels for this file
    const result = await db().select()
      .from(speakerLabels)
      .where(eq(speakerLabels.fileId, fileId))
      .limit(1);

    const labels = result[0]?.labels ? JSON.parse(result[0].labels) : {};

    return NextResponse.json({
      fileId,
      labels,
      hasCustomNames: Object.keys(labels).length > 0,
    });

  } catch (error) {
    console.error('Failed to get speaker labels:', error);
    return NextResponse.json(
      { error: 'Failed to get speaker labels' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const body = await request.json();
    const { labels } = body;

    if (!labels || typeof labels !== 'object') {
      return NextResponse.json({ error: 'Invalid labels format' }, { status: 400 });
    }

    // Validate that speaker IDs follow expected format
    for (const speakerId of Object.keys(labels)) {
      if (!speakerId.startsWith('SPEAKER_')) {
        return NextResponse.json({
          error: `Invalid speaker ID format: ${speakerId}. Expected format: SPEAKER_XX`,
        }, { status: 400 });
      }
    }

    const now = new Date();
    const labelsJson = JSON.stringify(labels);

    // Check if labels already exist for this file
    const existing = await db().select()
      .from(speakerLabels)
      .where(eq(speakerLabels.fileId, fileId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing labels
      await db().update(speakerLabels)
        .set({
          labels: labelsJson,
          updatedAt: now,
        })
        .where(eq(speakerLabels.fileId, fileId));
    } else {
      // Insert new labels
      await db().insert(speakerLabels)
        .values({
          fileId,
          labels: labelsJson,
          createdAt: now,
          updatedAt: now,
        });
    }

    return NextResponse.json({
      success: true,
      fileId,
      labels,
      updatedAt: now.toISOString(),
    });

  } catch (error) {
    console.error('Failed to save speaker labels:', error);
    return NextResponse.json(
      { error: 'Failed to save speaker labels' },
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
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Delete speaker labels for this file
    await db().delete(speakerLabels)
      .where(eq(speakerLabels.fileId, fileId));

    return NextResponse.json({
      success: true,
      message: 'Speaker labels reset successfully',
    });

  } catch (error) {
    console.error('Failed to delete speaker labels:', error);
    return NextResponse.json(
      { error: 'Failed to reset speaker labels' },
      { status: 500 },
    );
  }
}
