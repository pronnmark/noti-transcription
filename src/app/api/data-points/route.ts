import { NextRequest, NextResponse } from 'next/server';
import { db, dataPoints, dataPointTemplates, audioFiles, eq, and, inArray } from '@/lib/database';
import { requireAuth } from '@/lib/auth';

// Debug logging (can be disabled by setting DEBUG_API=false)
const DEBUG_API = process.env.DEBUG_API !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_API) {
    console.log(...args);
  }
};

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');
    const templateId = url.searchParams.get('templateId');

    // Build query conditions
    const whereConditions = [];
    if (fileId) {
      whereConditions.push(eq(dataPoints.fileId, parseInt(fileId)));
    }
    if (templateId) {
      whereConditions.push(eq(dataPoints.templateId, templateId));
    }

    // Get data points with template information
    const dataPointsResult = await db.select()
      .from(dataPoints)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(dataPoints.createdAt);

    // Get template names for display
    const templateIds = Array.from(new Set(dataPointsResult.map((dp: typeof dataPoints.$inferSelect) => dp.templateId))) as string[];
    const templates = templateIds.length > 0
      ? await db.select().from(dataPointTemplates).where(inArray(dataPointTemplates.id, templateIds))
      : [];

    const templateMap = Object.fromEntries(
      templates.map((t: typeof dataPointTemplates.$inferSelect) => [t.id, t]),
    );

    // Enrich data points with template information
    const enrichedDataPoints = dataPointsResult.map((dataPoint: typeof dataPoints.$inferSelect) => ({
      ...dataPoint,
      template: templateMap[dataPoint.templateId] || null,
      analysis_results: typeof dataPoint.analysisResults === 'string'
        ? JSON.parse(dataPoint.analysisResults)
        : dataPoint.analysisResults,
    }));

    return NextResponse.json({
      dataPoints: enrichedDataPoints,
      templates: templates,
    });
  } catch (error) {
    debugLog('Error fetching data points:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      fileId,
      templateId,
      analysisResults,
      model = 'gemini-2.5-flash',
    } = body;

    // Validate required fields
    if (!fileId || !templateId || !analysisResults) {
      return NextResponse.json({
        error: 'Missing required fields: fileId, templateId, analysisResults',
      }, { status: 400 });
    }

    // Verify file exists
    const fileResult = await db.select().from(audioFiles).where(eq(audioFiles.id, parseInt(fileId))).limit(1);
    const file = fileResult[0];

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Verify template exists
    const templateResult = await db.select().from(dataPointTemplates).where(eq(dataPointTemplates.id, templateId)).limit(1);
    const template = templateResult[0];

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Create data point
    const [dataPoint] = await db.insert(dataPoints).values({
      fileId: parseInt(fileId),
      templateId: templateId,
      analysisResults: JSON.stringify(analysisResults),
      model: model,
    }).returning();

    // Data point already returned from insert, no need to fetch again

    return NextResponse.json({
      success: true,
      dataPoint: {
        ...dataPoint,
        analysis_results: typeof dataPoint?.analysisResults === 'string'
          ? JSON.parse(dataPoint.analysisResults)
          : dataPoint?.analysisResults,
      },
    });

  } catch (error) {
    debugLog('Error creating data point:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
