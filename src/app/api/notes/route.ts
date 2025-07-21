import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { join } from 'path';

// Simple notes API using SQLite directly
const getDb = () => new Database(join(process.cwd(), 'sqlite.db'));

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    const db = getDb();

    let notes;
    if (fileId) {
      // Get notes for specific file
      notes = db.prepare(`
        SELECT n.*, af.original_file_name 
        FROM notes n
        JOIN audio_files af ON n.file_id = af.id
        WHERE n.file_id = ?
        ORDER BY n.created_at DESC
      `).all(parseInt(fileId));
    } else {
      // Get all notes
      notes = db.prepare(`
        SELECT n.*, af.original_file_name 
        FROM notes n
        JOIN audio_files af ON n.file_id = af.id
        ORDER BY n.created_at DESC
        LIMIT 100
      `).all();
    }

    db.close();

    return NextResponse.json({
      notes,
      total: notes.length,
    });
  } catch (error: any) {
    console.error('Notes GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notes' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, content } = body;

    if (!fileId || !content) {
      return NextResponse.json(
        { error: 'fileId and content are required' },
        { status: 400 },
      );
    }

    const db = getDb();

    // Check if file exists
    const file = db.prepare('SELECT id FROM audio_files WHERE id = ?').get(fileId);
    if (!file) {
      db.close();
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 },
      );
    }

    // Insert note
    const result = db.prepare(`
      INSERT INTO notes (file_id, content)
      VALUES (?, ?)
    `).run(fileId, content);

    // Get the created note
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);

    db.close();

    return NextResponse.json({
      success: true,
      note,
    });
  } catch (error: any) {
    console.error('Notes POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create note' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, content } = body;

    if (!id || !content) {
      return NextResponse.json(
        { error: 'id and content are required' },
        { status: 400 },
      );
    }

    const db = getDb();

    // Update note
    const result = db.prepare(`
      UPDATE notes 
      SET content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(content, id);

    if (result.changes === 0) {
      db.close();
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 },
      );
    }

    // Get the updated note
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);

    db.close();

    return NextResponse.json({
      success: true,
      note,
    });
  } catch (error: any) {
    console.error('Notes PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update note' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 },
      );
    }

    const db = getDb();

    // Delete note
    const result = db.prepare('DELETE FROM notes WHERE id = ?').run(parseInt(id));

    db.close();

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Note deleted',
    });
  } catch (error: any) {
    console.error('Notes DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete note' },
      { status: 500 },
    );
  }
}
