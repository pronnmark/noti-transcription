import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and, inArray } from '@/lib/db';
import * as schema from '@/lib/db';
import { requireAuth } from '@/lib/auth';

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
      whereConditions.push(eq(schema.dataPoints.fileId, parseInt(fileId)));
    }
    if (templateId) {
      whereConditions.push(eq(schema.dataPoints.templateId, templateId));
    }

    // Get data points with template information
    const dataPointsResult = await db.query.dataPoints?.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: (dataPoints: any, { desc }: any) => [desc(dataPoints.createdAt)],
    }) || [];

    // Get template names for display
    const templateIds = Array.from(new Set(dataPointsResult.map((dp: any) => dp.templateId))) as string[];
    const templates = await db.query.dataPointTemplates?.findMany({
      where: templateIds.length > 0 ? inArray(schema.dataPointTemplates.id, templateIds) : undefined,
    }) || [];

    const templateMap = Object.fromEntries(
      templates.map((t: any) => [t.id, t]),
    );

    // Enrich data points with template information
    const enrichedDataPoints = dataPointsResult.map((dataPoint: any) => ({
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
    console.error('Error fetching data points:', error);
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
    const file = await db.query.audioFiles.findFirst({
      where: (audioFiles: any, { eq }: any) => eq(audioFiles.id, parseInt(fileId)),
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Verify template exists
    const template = await db.query.dataPointTemplates?.findFirst({
      where: (templates: any, { eq }: any) => eq(templates.id, templateId),
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Create data point
    const [dataPoint] = await db.insert(schema.dataPoints).values({
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
    console.error('Error creating data point:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
