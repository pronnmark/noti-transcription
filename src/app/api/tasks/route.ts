import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const TASKS_FILE = join(DATA_DIR, 'tasks.json');

type Task = {
  id: string;
  content: string;
  status: 'active' | 'completed' | 'archived';
  priority: 'high' | 'medium' | 'low';
  fileId?: string;
  fileName?: string;
  originalFileName?: string;
  createdAt: string;
  updatedAt: string;
};

// Helper functions
function loadTasks(): Task[] {
  if (!existsSync(TASKS_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(TASKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading tasks:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const withFileInfo = url.searchParams.get('withFileInfo') === 'true';

    let tasks = loadTasks();

    // Filter by status if specified
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }

    // Note: withFileInfo would require joining with file data
    // For now, return tasks as-is (file info can be added later if needed)

    return NextResponse.json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 },
    );
  }
}
