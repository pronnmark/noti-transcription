import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and, inArray } from '@/lib/db/sqlite';
import { extractions, extractionTemplates, audioFiles } from '@/lib/db/sqliteSchema';
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
    const status = url.searchParams.get('status');

    // Build query conditions
    let whereConditions = [];
    if (fileId) {
      whereConditions.push(eq(extractions.fileId, parseInt(fileId)));
    }
    if (templateId) {
      whereConditions.push(eq(extractions.templateId, templateId));
    }
    if (status) {
      whereConditions.push(eq(extractions.status, status));
    }

    // Get extractions with template information
    const extractionsResult = await db.query.extractions?.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: (extractions, { desc }) => [desc(extractions.createdAt)],
    }) || [];

    // Get template names for display
    const templateIds = Array.from(new Set(extractionsResult.map(e => e.templateId)));
    const templates = await db.query.extractionTemplates?.findMany({
      where: inArray(extractionTemplates.id, templateIds),
    }) || [];

    const templateMap = Object.fromEntries(
      templates.map(t => [t.id, t])
    );

    // Enrich extractions with template information
    const enrichedExtractions = extractionsResult.map(extraction => ({
      ...extraction,
      template: templateMap[extraction.templateId] || null,
    }));

    return NextResponse.json({
      extractions: enrichedExtractions,
      templates: templates,
    });
  } catch (error) {
    console.error('Error fetching extractions:', error);
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
      content, 
      context, 
      speaker, 
      timestamp, 
      priority = 'medium',
      metadata = {},
      comments 
    } = body;

    // Validate required fields
    if (!fileId || !templateId || !content) {
      return NextResponse.json({ 
        error: 'Missing required fields: fileId, templateId, content' 
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
    const template = await db.query.extractionTemplates?.findFirst({
      where: (templates, { eq }) => eq(templates.id, templateId),
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Create extraction
    const extractionId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(extractions).values({
      id: extractionId,
      fileId: parseInt(fileId),
      templateId: templateId,
      content: content,
      context: context || null,
      speaker: speaker || null,
      timestamp: timestamp || null,
      priority: priority,
      status: 'active',
      metadata: JSON.stringify(metadata),
      comments: comments || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Get the created extraction
    const extraction = await db.query.extractions?.findFirst({
      where: (extractions, { eq }) => eq(extractions.id, extractionId),
    });

    return NextResponse.json({
      success: true,
      extraction: extraction,
    });

  } catch (error) {
    console.error('Error creating extraction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}