import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and, inArray } from '@/lib/db/sqlite';
import * as schema from '@/lib/db/sqliteSchema';
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
    let whereConditions = [];
    if (fileId) {
      whereConditions.push(eq(schema.dataPoints.fileId, parseInt(fileId)));
    }
    if (templateId) {
      whereConditions.push(eq(schema.dataPoints.templateId, templateId));
    }

    // Get data points with template information
    const dataPointsResult = await db.query.dataPoints?.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: (dataPoints, { desc }) => [desc(dataPoints.createdAt)],
    }) || [];

    // Get template names for display
    const templateIds = Array.from(new Set(dataPointsResult.map(dp => dp.templateId)));
    const templates = await db.query.dataPointTemplates?.findMany({
      where: inArray(schema.dataPointTemplates.id, templateIds),
    }) || [];

    const templateMap = Object.fromEntries(
      templates.map(t => [t.id, t])
    );

    // Enrich data points with template information
    const enrichedDataPoints = dataPointsResult.map(dataPoint => ({
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
      model = 'openrouter/auto'
    } = body;

    // Validate required fields
    if (!fileId || !templateId || !analysisResults) {
      return NextResponse.json({ 
        error: 'Missing required fields: fileId, templateId, analysisResults' 
      }, { status: 400 });
    }

    // Verify file exists
    const file = await db.query.audioFiles.findFirst({
      where: (audioFiles, { eq }) => eq(audioFiles.id, parseInt(fileId)),
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Verify template exists
    const template = await db.query.dataPointTemplates?.findFirst({
      where: (templates, { eq }) => eq(templates.id, templateId),
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Create data point
    const dataPointId = `dp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(schema.dataPoints).values({
      id: dataPointId,
      fileId: parseInt(fileId),
      templateId: templateId,
      analysisResults: JSON.stringify(analysisResults),
      model: model,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Get the created data point
    const dataPoint = await db.query.dataPoints?.findFirst({
      where: (dataPoints, { eq }) => eq(dataPoints.id, dataPointId),
    });

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