import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/database/client';
import { audioFiles, fileLabels } from '../../../../../lib/database/schema/audio';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);
    const db = getDb();

    // Get labels for this file
    const labelRecord = await db
      .select()
      .from(fileLabels)
      .where(eq(fileLabels.fileId, fileId))
      .limit(1);

    const labels = labelRecord.length > 0 ? (labelRecord[0].labels || []) : [];

    return NextResponse.json({
      fileId,
      labels,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching file labels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);
    const { labels } = await request.json();
    const db = getDb();

    // Validate that file exists
    const file = await db.select().from(audioFiles).where(eq(audioFiles.id, fileId)).limit(1);
    if (!file.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Validate labels format
    if (!Array.isArray(labels) || !labels.every(label => typeof label === 'string')) {
      return NextResponse.json({ error: 'Labels must be an array of strings' }, { status: 400 });
    }

    // Clean and deduplicate labels
    const cleanLabels = [...new Set(
      labels
        .map(label => label.trim())
        .filter(label => label.length > 0 && label.length <= 50),
    )];

    // Check if labels record exists
    const existingRecord = await db
      .select()
      .from(fileLabels)
      .where(eq(fileLabels.fileId, fileId))
      .limit(1);

    if (existingRecord.length > 0) {
      // Update existing record
      await db
        .update(fileLabels)
        .set({
          labels: cleanLabels,
          updatedAt: new Date(),
        })
        .where(eq(fileLabels.fileId, fileId));
    } else {
      // Create new record
      await db.insert(fileLabels).values({
        fileId,
        labels: cleanLabels,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      fileId,
      labels: cleanLabels,
      success: true,
    });
  } catch (error) {
    console.error('Error updating file labels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
