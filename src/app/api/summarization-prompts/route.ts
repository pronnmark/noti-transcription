import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/client';
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
    const supabase = getSupabase();
    const { data: dbPrompts, error } = await supabase
      .from('summarization_prompts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

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
        isDefault: Boolean(prompt.is_default),
        isActive: Boolean(prompt.is_active),
        createdAt: parseTimestamp(prompt.created_at),
        updatedAt: parseTimestamp(prompt.updated_at),
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

    const supabase = getSupabase();

    // If setting as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('summarization_prompts')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    // Create new summarization prompt
    const newPromptId = createId();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from('summarization_prompts')
      .insert({
        id: newPromptId,
        name,
        description: description || null,
        prompt,
        is_default: isDefault || false,
        is_active: true,
        created_at: now,
        updated_at: now,
      });

    if (insertError) {
      throw insertError;
    }

    // Format response to match API format
    const newPrompt: SummarizationPrompt = {
      id: newPromptId,
      name,
      description: description || '',
      prompt,
      isDefault: isDefault || false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
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

    const supabase = getSupabase();

    // Check if prompt exists
    const { data: existingPrompt, error: checkError } = await supabase
      .from('summarization_prompts')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (checkError || !existingPrompt || existingPrompt.length === 0) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (updates.isDefault) {
      await supabase
        .from('summarization_prompts')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    // Prepare update data
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Convert camelCase to snake_case for database
    if (updateData.isDefault !== undefined) {
      updateData.is_default = updateData.isDefault;
      delete updateData.isDefault;
    }
    if (updateData.isActive !== undefined) {
      updateData.is_active = updateData.isActive;
      delete updateData.isActive;
    }

    // Remove undefined/null values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update summarization prompt
    const { error: updateError } = await supabase
      .from('summarization_prompts')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

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

    const supabase = getSupabase();

    // Check if prompt exists
    const { data: existingPrompt, error: checkError } = await supabase
      .from('summarization_prompts')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (checkError || !existingPrompt || existingPrompt.length === 0) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // Delete the prompt
    const { error: deleteError } = await supabase
      .from('summarization_prompts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

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
