import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const TEMPLATES_FILE = join(DATA_DIR, 'extract_templates.json');

interface ExtractTemplate {
  id: string;
  name: string;
  prompt: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

async function readTemplates(): Promise<ExtractTemplate[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data = await fs.readFile(TEMPLATES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeTemplates(templates: ExtractTemplate[]): Promise<void> {
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
}

// GET - List all templates
export async function GET(request: NextRequest) {
  try {
    const templates = await readTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Failed to load templates' },
      { status: 500 }
    );
  }
}

// POST - Create new template
export async function POST(request: NextRequest) {
  try {
    const { name, prompt, model } = await request.json();

    if (!name || !prompt) {
      return NextResponse.json(
        { error: 'Name and prompt are required' },
        { status: 400 }
      );
    }

    const templates = await readTemplates();
    
    // Check if name already exists
    if (templates.some(t => t.name === name)) {
      return NextResponse.json(
        { error: 'Template name already exists' },
        { status: 400 }
      );
    }

    const newTemplate: ExtractTemplate = {
      id: uuidv4(),
      name,
      prompt,
      model,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    templates.push(newTemplate);
    await writeTemplates(templates);

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const templates = await readTemplates();
    const filteredTemplates = templates.filter(t => t.id !== templateId);

    if (filteredTemplates.length === templates.length) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    await writeTemplates(filteredTemplates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}