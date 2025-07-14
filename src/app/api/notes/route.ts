import { NextRequest, NextResponse } from 'next/server';
import { notesService } from '@/lib/db/notesService';
import { requireAuth } from '@/lib/auth';

// GET /api/notes?fileId=123&type=task&status=active
export async function GET(request: NextRequest) {
  try {
    // Check authentication - temporarily relaxed for development
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      console.warn('⚠️ Authentication bypassed for development - please login for production use');
      // Continue anyway for now
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const noteType = searchParams.get('type');
    const status = searchParams.get('status');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    let notes;
    if (noteType) {
      notes = await notesService.findByFileIdAndType(parseInt(fileId), noteType);
    } else {
      notes = await notesService.findByFileId(parseInt(fileId));
    }

    // Filter by status if provided
    if (status) {
      notes = notes.filter(note => note.status === status);
    }

    // Group notes by type for easier consumption
    const groupedNotes = {
      tasks: notes.filter(n => n.noteType === 'task'),
      questions: notes.filter(n => n.noteType === 'question'),
      decisions: notes.filter(n => n.noteType === 'decision'),
      followups: notes.filter(n => n.noteType === 'followup'),
      mentions: notes.filter(n => n.noteType === 'mention'),
    };

    return NextResponse.json({
      notes,
      grouped: groupedNotes,
      total: notes.length,
      counts: {
        tasks: groupedNotes.tasks.length,
        questions: groupedNotes.questions.length,
        decisions: groupedNotes.decisions.length,
        followups: groupedNotes.followups.length,
        mentions: groupedNotes.mentions.length,
      }
    });

  } catch (error) {
    console.error('Get notes API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

// POST /api/notes - Create a manual note
export async function POST(request: NextRequest) {
  try {
    // Check authentication - temporarily relaxed for development
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      console.warn('⚠️ Authentication bypassed for development - please login for production use');
      // Continue anyway for now
    }

    const body = await request.json();
    const { fileId, noteType, content, speaker, timestamp, priority, context } = body;

    if (!fileId || !noteType || !content) {
      return NextResponse.json(
        { error: 'fileId, noteType, and content are required' },
        { status: 400 }
      );
    }

    const note = await notesService.create({
      fileId: parseInt(fileId),
      noteType,
      content,
      speaker,
      timestamp,
      priority: priority || 'medium',
      context,
      status: 'active'
    });

    // Update file notes count
    await notesService.updateFileNotesCount(parseInt(fileId));

    return NextResponse.json({ success: true, note });

  } catch (error) {
    console.error('Create note API error:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}

// PATCH /api/notes - Update note
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication - temporarily relaxed for development
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      console.warn('⚠️ Authentication bypassed for development - please login for production use');
      // Continue anyway for now
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    const updated = await notesService.update(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, note: updated });

  } catch (error) {
    console.error('Update note API error:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}