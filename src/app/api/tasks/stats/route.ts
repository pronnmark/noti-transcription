import { NextRequest, NextResponse } from 'next/server';
import { notesService } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const stats = await notesService.getGlobalStats();
    
    return NextResponse.json({ 
      success: true, 
      stats 
    });
  } catch (error) {
    console.error('Error fetching global stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch global stats' },
      { status: 500 }
    );
  }
}