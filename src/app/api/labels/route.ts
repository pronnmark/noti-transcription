import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/database/client';
import { fileLabels } from '../../../lib/database/schema/audio';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const db = getDb();

    // Get all labels across all files
    const labelRecords = await db
      .select({
        labels: fileLabels.labels,
      })
      .from(fileLabels);

    // Flatten all labels and count frequency
    const labelCounts: Record<string, number> = {};

    labelRecords.forEach(record => {
      if (Array.isArray(record.labels)) {
        record.labels.forEach(label => {
          if (typeof label === 'string' && label.trim()) {
            const normalizedLabel = label.trim().toLowerCase();
            labelCounts[normalizedLabel] =
              (labelCounts[normalizedLabel] || 0) + 1;
          }
        });
      }
    });

    // Convert to array and filter by query if provided
    let allLabels = Object.entries(labelCounts).map(([label, count]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1), // Capitalize first letter
      count,
    }));

    // Filter by query if provided
    if (query) {
      const queryLower = query.toLowerCase();
      allLabels = allLabels.filter(item =>
        item.label.toLowerCase().includes(queryLower),
      );
    }

    // Sort by frequency (most used first), then alphabetically
    allLabels.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    });

    // Limit results for autocomplete
    const limit = parseInt(searchParams.get('limit') || '20');
    if (limit > 0) {
      allLabels = allLabels.slice(0, limit);
    }

    return NextResponse.json({
      labels: allLabels,
      total: Object.keys(labelCounts).length,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
