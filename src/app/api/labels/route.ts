import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/database/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const supabase = getSupabase();

    // Get unique labels from file_labels table
    const { data: results, error } = await supabase
      .from('file_labels')
      .select('labels')
      .not('labels', 'is', null);

    if (error) {
      console.error('Error fetching labels:', error);
      return NextResponse.json({ error: 'Failed to fetch labels' }, { status: 500 });
    }

    // Flatten and deduplicate labels
    const allLabels = new Set<string>();
    results?.forEach(record => {
      if (Array.isArray(record.labels)) {
        record.labels.forEach((label: string) => {
          if (typeof label === 'string' && label.trim()) {
            allLabels.add(label.trim());
          }
        });
      }
    });

    // Filter labels based on query
    const filteredLabels = Array.from(allLabels).filter(label =>
      query ? label.toLowerCase().includes(query.toLowerCase()) : true
    );

    return NextResponse.json({
      labels: filteredLabels.sort(),
      total: filteredLabels.length,
    });
  } catch (error) {
    console.error('Labels API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}