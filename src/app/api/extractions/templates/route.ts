import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database/client';
import { eq, and } from 'drizzle-orm';
import { extractionTemplates, extractions } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('activeOnly') === 'true';
    const defaultOnly = url.searchParams.get('defaultOnly') === 'true';

    const whereConditions = [];
    if (activeOnly) {
      whereConditions.push(eq(extractionTemplates.isActive, true));
    }
    if (defaultOnly) {
      whereConditions.push(eq(extractionTemplates.isDefault, true));
    }

    const db = getDb();
    const templates = await db.query.extractionTemplates?.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: (templates: any, { desc, asc }: any) => [
        desc(templates.isDefault),
        desc(templates.isActive),
        asc(templates.name),
      ],
    }) || [];

    return NextResponse.json({
      templates: templates,
    });
  } catch (error) {
    console.error('Error fetching extraction templates:', error);
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
      name,
      description,
      prompt,
      expectedOutputFormat,
      defaultPriority = 'medium',
      isActive = true,
      isDefault = false,
    } = body;

    // Validate required fields
    if (!name || !prompt) {
      return NextResponse.json({
        error: 'Missing required fields: name, prompt',
      }, { status: 400 });
    }

    // Create template
    const db = getDb();
    const [template] = await db.insert(extractionTemplates).values({
      name: name,
      description: description || null,
      prompt: prompt,
      expectedOutputFormat: expectedOutputFormat || null,
      defaultPriority: defaultPriority,
      isActive: isActive,
      isDefault: isDefault,
    }).returning();

    // Template already returned from insert, no need to fetch again

    return NextResponse.json({
      success: true,
      template: template,
    });

  } catch (error) {
    console.error('Error creating extraction template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      prompt,
      expectedOutputFormat,
      defaultPriority,
      isActive,
      isDefault,
    } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json({
        error: 'Missing required field: id',
      }, { status: 400 });
    }

    // Check if template exists
    const db = getDb();
    const existingTemplate = await db.query.extractionTemplates?.findFirst({
      where: (templates: any, { eq }: any) => eq(templates.id, id),
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Update template
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (expectedOutputFormat !== undefined) updateData.expectedOutputFormat = expectedOutputFormat;
    if (defaultPriority !== undefined) updateData.defaultPriority = defaultPriority;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    await db.update(extractionTemplates)
      .set(updateData)
      .where(eq(extractionTemplates.id, id));

    // Get the updated template
    const template = await db.query.extractionTemplates?.findFirst({
      where: (templates: any, { eq }: any) => eq(templates.id, id),
    });

    return NextResponse.json({
      success: true,
      template: template,
    });

  } catch (error) {
    console.error('Error updating extraction template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        error: 'Missing required parameter: id',
      }, { status: 400 });
    }

    // Check if template exists
    const db = getDb();
    const existingTemplate = await db.query.extractionTemplates?.findFirst({
      where: (templates: any, { eq }: any) => eq(templates.id, id),
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if template is in use
    const extractionsCount = await db.query.extractions?.findMany({
      where: (extractions: any, { eq }: any) => eq(extractions.templateId, id),
    });

    if (extractionsCount && extractionsCount.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete template that is in use. Deactivate it instead.',
      }, { status: 400 });
    }

    // Delete template
    await db.delete(extractionTemplates)
      .where(eq(extractionTemplates.id, id));

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting extraction template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
