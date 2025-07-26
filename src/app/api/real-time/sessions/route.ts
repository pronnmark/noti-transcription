import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { realTimeSessions } from '@/lib/database/schema/system';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (fileId) {
      // Get sessions for a specific file
      const sessions = await db
        .select()
        .from(realTimeSessions)
        .where(eq(realTimeSessions.fileId, parseInt(fileId)))
        .orderBy(desc(realTimeSessions.createdAt));

      return NextResponse.json({ sessions });
    } else {
      // Get all sessions
      const sessions = await db
        .select()
        .from(realTimeSessions)
        .orderBy(desc(realTimeSessions.createdAt))
        .limit(50);

      return NextResponse.json({ sessions });
    }
  } catch (error) {
    console.error('Error fetching real-time sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileId, chunkIntervalMs, aiInstruction } = await request.json();

    if (!fileId || !chunkIntervalMs || !aiInstruction) {
      return NextResponse.json(
        { error: 'fileId, chunkIntervalMs, and aiInstruction are required' },
        { status: 400 }
      );
    }

    // Check if there's already an active session for this file
    const existingSession = await db
      .select()
      .from(realTimeSessions)
      .where(
        eq(realTimeSessions.fileId, fileId)
      )
      .orderBy(desc(realTimeSessions.createdAt))
      .limit(1);

    if (existingSession.length > 0 && existingSession[0].status === 'active') {
      return NextResponse.json(
        { error: 'An active real-time session already exists for this file' },
        { status: 409 }
      );
    }

    const sessionId = createId();
    const newSession = await db
      .insert(realTimeSessions)
      .values({
        id: sessionId,
        fileId,
        chunkIntervalMs,
        aiInstruction,
        status: 'active',
        totalChunks: 0,
      })
      .returning();

    return NextResponse.json({ session: newSession[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating real-time session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { sessionId, status, endedAt, totalChunks } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (endedAt) updateData.endedAt = new Date(endedAt);
    if (totalChunks !== undefined) updateData.totalChunks = totalChunks;

    const updatedSession = await db
      .update(realTimeSessions)
      .set(updateData)
      .where(eq(realTimeSessions.id, sessionId))
      .returning();

    if (updatedSession.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: updatedSession[0] });
  } catch (error) {
    console.error('Error updating real-time session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}