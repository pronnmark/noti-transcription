import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { realTimeThoughts } from '@/lib/database/schema/system';
import { eq, desc, asc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Get thoughts for a specific session, ordered by chunk number
    const thoughts = await db
      .select()
      .from(realTimeThoughts)
      .where(eq(realTimeThoughts.sessionId, sessionId))
      .orderBy(asc(realTimeThoughts.chunkNumber))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ thoughts });
  } catch (error) {
    console.error('Error fetching real-time thoughts:', error);
    return NextResponse.json({ error: 'Failed to fetch thoughts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      chunkNumber,
      chunkStartTime,
      chunkEndTime,
      transcriptText,
      aiThought,
      processingTimeMs,
      status = 'completed'
    } = await request.json();

    if (!sessionId || chunkNumber === undefined || !transcriptText || !aiThought) {
      return NextResponse.json(
        { error: 'sessionId, chunkNumber, transcriptText, and aiThought are required' },
        { status: 400 }
      );
    }

    const thoughtId = createId();
    const newThought = await db
      .insert(realTimeThoughts)
      .values({
        id: thoughtId,
        sessionId,
        chunkNumber,
        chunkStartTime: chunkStartTime ? parseInt(chunkStartTime) : 0,
        chunkEndTime: chunkEndTime ? parseInt(chunkEndTime) : 0,
        transcriptText,
        aiThought,
        processingTimeMs,
        status,
      })
      .returning();

    return NextResponse.json({ thought: newThought[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating real-time thought:', error);
    return NextResponse.json({ error: 'Failed to create thought' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { thoughtId, status, aiThought, processingTimeMs } = await request.json();

    if (!thoughtId) {
      return NextResponse.json({ error: 'thoughtId is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (aiThought) updateData.aiThought = aiThought;
    if (processingTimeMs !== undefined) updateData.processingTimeMs = processingTimeMs;

    const updatedThought = await db
      .update(realTimeThoughts)
      .set(updateData)
      .where(eq(realTimeThoughts.id, thoughtId))
      .returning();

    if (updatedThought.length === 0) {
      return NextResponse.json({ error: 'Thought not found' }, { status: 404 });
    }

    return NextResponse.json({ thought: updatedThought[0] });
  } catch (error) {
    console.error('Error updating real-time thought:', error);
    return NextResponse.json({ error: 'Failed to update thought' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const thoughtId = searchParams.get('thoughtId');

    if (!thoughtId) {
      return NextResponse.json({ error: 'thoughtId is required' }, { status: 400 });
    }

    const deletedThought = await db
      .delete(realTimeThoughts)
      .where(eq(realTimeThoughts.id, thoughtId))
      .returning();

    if (deletedThought.length === 0) {
      return NextResponse.json({ error: 'Thought not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Thought deleted successfully' });
  } catch (error) {
    console.error('Error deleting real-time thought:', error);
    return NextResponse.json({ error: 'Failed to delete thought' }, { status: 500 });
  }
}