import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database/client';
import { eq, and } from 'drizzle-orm';
import { dataPointTemplates, dataPoints as _dataPoints } from '@/lib/db';
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
    const activeOnly = url.searchParams.get('activeOnly') === 'true';
    const defaultOnly = url.searchParams.get('defaultOnly') === 'true';

    const whereConditions = [];
    if (activeOnly) {
      whereConditions.push(eq(dataPointTemplates.isActive, true));
    }
    if (defaultOnly) {
      whereConditions.push(eq(dataPointTemplates.isDefault, true));
    }

    const db = getDb();
    const templates = await db.query.dataPointTemplates?.findMany({
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
    debugLog('Error fetching data point templates:', error);
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
      analysisPrompt,
      outputSchema,
      visualizationType = 'chart',
      isActive = true,
      isDefault = false,
    } = body;

    // Validate required fields
    if (!name || !analysisPrompt) {
      return NextResponse.json({
        error: 'Missing required fields: name, analysisPrompt',
      }, { status: 400 });
    }

    // Create template
    const db = getDb();
    const [template] = await db.insert(dataPointTemplates).values({
      name: name,
      description: description || null,
      analysisPrompt: analysisPrompt,
      outputSchema: outputSchema || null,
      visualizationType: visualizationType,
      isActive: isActive,
      isDefault: isDefault,
    }).returning();

    // Template already returned from insert, no need to fetch again

    return NextResponse.json({
      success: true,
      template: template,
    });

  } catch (error) {
    debugLog('Error creating data point template:', error);
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
      analysisPrompt,
      outputSchema,
      visualizationType,
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
    const existingTemplate = await db.query.dataPointTemplates?.findFirst({
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
    if (analysisPrompt !== undefined) updateData.analysisPrompt = analysisPrompt;
    if (outputSchema !== undefined) updateData.outputSchema = outputSchema;
    if (visualizationType !== undefined) updateData.visualizationType = visualizationType;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    await db.update(dataPointTemplates)
      .set(updateData)
      .where(eq(dataPointTemplates.id, id));

    // Get the updated template
    const template = await db.query.dataPointTemplates?.findFirst({
      where: (templates: any, { eq }: any) => eq(templates.id, id),
    });

    return NextResponse.json({
      success: true,
      template: template,
    });

  } catch (error) {
    debugLog('Error updating data point template:', error);
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
    const existingTemplate = await db.query.dataPointTemplates?.findFirst({
      where: (templates: any, { eq }: any) => eq(templates.id, id),
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if template is in use
    const dataPointsCount = await db.query.dataPoints?.findMany({
      where: (dataPoints: any, { eq }: any) => eq(dataPoints.templateId, id),
    });

    if (dataPointsCount && dataPointsCount.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete template that is in use. Deactivate it instead.',
      }, { status: 400 });
    }

    // Delete template
    await db.delete(dataPointTemplates)
      .where(eq(dataPointTemplates.id, id));

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });

  } catch (error) {
    debugLog('Error deleting data point template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
