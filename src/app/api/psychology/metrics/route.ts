import { NextRequest, NextResponse } from 'next/server';
import { psychologyService } from '@/lib/services/psychologyService';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (date) {
      // Get metrics for specific date
      const metrics = await psychologyService.getDailyMetrics(date);
      return NextResponse.json({ 
        success: true, 
        metrics 
      });
    } else if (startDate && endDate) {
      // Get metrics for date range
      const metrics = await psychologyService.getMetricsByDateRange(startDate, endDate);
      return NextResponse.json({ 
        success: true, 
        metrics,
        count: metrics.length 
      });
    } else {
      // Get recent metrics (last 30 days)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const metrics = await psychologyService.getMetricsByDateRange(startDate, endDate);
      return NextResponse.json({ 
        success: true, 
        metrics,
        count: metrics.length 
      });
    }
  } catch (error) {
    console.error('Error fetching psychological metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch psychological metrics' },
      { status: 500 }
    );
  }
}