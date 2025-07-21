import { NextRequest, NextResponse } from 'next/server';
import { dynamicPromptGenerator } from '@/lib/services/dynamicPromptGenerator';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const definitions = await dynamicPromptGenerator.getActiveExtractionDefinitions();
    
    return NextResponse.json({
      definitions,
    });
  } catch (error) {
    console.error('Error fetching extraction definitions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { name, description, jsonKey, jsonSchema, aiInstructions, outputType, category } = body;
    
    // Validate required fields
    if (!name || !jsonKey || !jsonSchema || !aiInstructions) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, jsonKey, jsonSchema, aiInstructions' 
      }, { status: 400 });
    }
    
    // Validate JSON schema
    try {
      JSON.parse(typeof jsonSchema === 'string' ? jsonSchema : JSON.stringify(jsonSchema));
    } catch (error) {
      return NextResponse.json({ 
        error: 'Invalid JSON schema format' 
      }, { status: 400 });
    }
    
    // Create new extraction definition
    const newDefinition = await dynamicPromptGenerator.createExtractionDefinition({
      name,
      description: description || '',
      jsonKey,
      jsonSchema,
      aiInstructions,
      outputType: outputType || 'array',
      category: category || 'extraction',
    });
    
    return NextResponse.json({
      success: true,
      definition: newDefinition,
    });
    
  } catch (error) {
    console.error('Error creating extraction definition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Missing definition ID' }, { status: 400 });
    }
    
    // Validate JSON schema if provided
    if (updates.jsonSchema) {
      try {
        JSON.parse(typeof updates.jsonSchema === 'string' ? updates.jsonSchema : JSON.stringify(updates.jsonSchema));
      } catch (error) {
        return NextResponse.json({ 
          error: 'Invalid JSON schema format' 
        }, { status: 400 });
      }
    }
    
    // Update extraction definition
    await dynamicPromptGenerator.updateExtractionDefinition(id, updates);
    
    return NextResponse.json({
      success: true,
    });
    
  } catch (error) {
    console.error('Error updating extraction definition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Missing definition ID' }, { status: 400 });
    }
    
    // Delete extraction definition
    await dynamicPromptGenerator.deleteExtractionDefinition(id);
    
    return NextResponse.json({
      success: true,
    });
    
  } catch (error) {
    console.error('Error deleting extraction definition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}