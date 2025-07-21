import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and, inArray } from "@/lib/db"
import { extractions, extractionTemplates, audioFiles } from "@/lib/db"
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
    if (status && ['active', 'completed', 'archived'].includes(status)) {
      whereConditions.push(eq(extractions.status, status as 'active' | 'completed' | 'archived'));
    }

    // Get extractions with template information
    const extractionsResult = await db.query.extractions?.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: (extractions: any, { desc }: any) => [desc(extractions.createdAt)],
    }) || [];

    // Get template names for display
    const templateIds = Array.from(new Set(extractionsResult.map((e: any) => e.templateId))) as string[];
    const templates = await db.query.extractionTemplates?.findMany({
      where: inArray(extractionTemplates.id, templateIds),
    }) || [];

    const templateMap = Object.fromEntries(
      templates.map((t: any) => [t.id, t])
    );

    // Enrich extractions with template information
    const enrichedExtractions = extractionsResult.map((extraction: any) => ({
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
      where: (audioFiles: any, { eq }: any) => eq(audioFiles.id, parseInt(fileId)),
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Verify template exists
    const template = await db.query.extractionTemplates?.findFirst({
      where: (templates: any, { eq }: any) => eq(templates.id, templateId),
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Create extraction
    const [extraction] = await db.insert(extractions).values({
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
    }).returning();

    // Extraction already returned from insert, no need to fetch again

    return NextResponse.json({
      success: true,
      extraction: extraction,
    });

  } catch (error) {
    console.error('Error creating extraction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}