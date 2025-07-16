import { NextRequest, NextResponse } from 'next/server';
import { notesService } from '@/lib/db/notesService';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const withFileInfo = url.searchParams.get('withFileInfo') === 'true';
    
    let tasks;
    
    if (withFileInfo) {
      // Get tasks with file name information
      tasks = await notesService.getTasksWithFileInfo();
    } else if (status) {
      // Get tasks by status
      tasks = await notesService.getTasksByStatus(status as 'active' | 'completed' | 'archived');
    } else {
      // Get all tasks
      tasks = await notesService.getAllTasks();
    }
    
    return NextResponse.json({ 
      success: true, 
      tasks,
      count: tasks.length 
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}