import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database/client';
import { summarizationPrompts } from '@/lib/database/schema/system';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

type SummarizationPrompt = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const dbPrompts = await db
      .select()
      .from(summarizationPrompts)
      .where(eq(summarizationPrompts.isActive, true))
      .orderBy(desc(summarizationPrompts.createdAt));

    // Convert database format to API format
    const prompts = dbPrompts.map(prompt => {
      // Handle different timestamp formats safely
      const parseTimestamp = (value: any): string => {
        if (!value) return new Date().toISOString();

        // If it's already a string, try to parse it
        if (typeof value === 'string') {
          const date = new Date(value);
          return isNaN(date.getTime())
            ? new Date().toISOString()
            : date.toISOString();
        }

        // If it's a number (Unix timestamp)
        if (typeof value === 'number') {
          // Handle both seconds and milliseconds timestamps
          const timestamp = value > 1e12 ? value : value * 1000;
          return new Date(timestamp).toISOString();
        }

        // If it's a Date object
        if (value instanceof Date) {
          return value.toISOString();
        }

        // Fallback to current time
        return new Date().toISOString();
      };

      return {
        id: prompt.id,
        name: prompt.name,
        description: prompt.description || '',
        prompt: prompt.prompt,
        isDefault: Boolean(prompt.isDefault),
        isActive: Boolean(prompt.isActive),
        createdAt: parseTimestamp(prompt.createdAt),
        updatedAt: parseTimestamp(prompt.updatedAt),
      };
    });

    return NextResponse.json({
      prompts,
    });
  } catch (error) {
    console.error('Error fetching summarization prompts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, prompt, isDefault } = body;

    // Validate required fields
    if (!name || !prompt) {
      return NextResponse.json(
        {
          error: 'Missing required fields: name, prompt',
        },
        { status: 400 },
      );
    }

    const db = getDb();

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(summarizationPrompts)
        .set({ isDefault: false })
        .where(eq(summarizationPrompts.isDefault, true));
    }

    // Create new summarization prompt
    const newPromptId = createId();
    const now = new Date();

    await db.insert(summarizationPrompts).values({
      id: newPromptId,
      name,
      description: description || null,
      prompt,
      isDefault: isDefault || false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Format response to match API format
    const newPrompt: SummarizationPrompt = {
      id: newPromptId,
      name,
      description: description || '',
      prompt,
      isDefault: isDefault || false,
      isActive: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return NextResponse.json({
      success: true,
      prompt: newPrompt,
    });
  } catch (error) {
    console.error('Error creating summarization prompt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing prompt ID' }, { status: 400 });
    }

    const db = getDb();

    // Check if prompt exists
    const existingPrompt = await db
      .select()
      .from(summarizationPrompts)
      .where(eq(summarizationPrompts.id, id))
      .limit(1);

    if (existingPrompt.length === 0) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (updates.isDefault) {
      await db
        .update(summarizationPrompts)
        .set({ isDefault: false })
        .where(eq(summarizationPrompts.isDefault, true));
    }

    // Prepare update data
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove undefined/null values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update summarization prompt
    await db
      .update(summarizationPrompts)
      .set(updateData)
      .where(eq(summarizationPrompts.id, id));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error updating summarization prompt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing prompt ID' }, { status: 400 });
    }

    const db = getDb();

    // Check if prompt exists
    const existingPrompt = await db
      .select()
      .from(summarizationPrompts)
      .where(eq(summarizationPrompts.id, id))
      .limit(1);

    if (existingPrompt.length === 0) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // Delete the prompt
    await db
      .delete(summarizationPrompts)
      .where(eq(summarizationPrompts.id, id));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting summarization prompt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
