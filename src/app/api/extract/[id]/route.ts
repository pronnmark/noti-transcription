import { NextRequest, NextResponse } from 'next/server';
import { getExtract, deleteExtract } from '@/lib/extractsDb';

// GET - Get individual extract by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const extract = await getExtract(id);
    if (!extract) {
      return NextResponse.json(
        { error: 'Extract not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(extract);
  } catch (error) {
    console.error('Get extract error:', error);
    return NextResponse.json(
      { error: 'Failed to get extract' },
      { status: 500 }
    );
  }
}

// DELETE - Delete individual extract
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await deleteExtract(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete extract error:', error);
    return NextResponse.json(
      { error: 'Failed to delete extract' },
      { status: 500 }
    );
  }
}