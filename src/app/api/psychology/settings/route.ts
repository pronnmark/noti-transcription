import { NextRequest, NextResponse } from 'next/server';
import { autoExtractionService } from '@/lib/services/autoExtractionService';
import { settingsService } from '@/lib/db/sqliteServices';

export async function GET(request: NextRequest) {
  try {
    const extractionSettings = await autoExtractionService.getAutoExtractionSettings();
    const psychologyEnabled = await autoExtractionService.isPsychologyEnabled();
    const psychologyAutoRun = await autoExtractionService.isPsychologyAutoRunEnabled();

    return NextResponse.json({
      success: true,
      settings: {
        ...extractionSettings,
        psychologyEnabled,
        psychologyAutoRun
      }
    });
  } catch (error) {
    console.error('Error fetching psychology settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch psychology settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { extractionSettings, psychologyEnabled, psychologyAutoRun } = await request.json();

    // Update extraction settings
    if (extractionSettings) {
      await autoExtractionService.updateAutoExtractionSettings(extractionSettings);
    }

    // Update psychology settings
    if (psychologyEnabled !== undefined || psychologyAutoRun !== undefined) {
      const updateData: any = {};
      if (psychologyEnabled !== undefined) {
        updateData.psychEvalEnabled = psychologyEnabled;
      }
      if (psychologyAutoRun !== undefined) {
        updateData.psychEvalAutoRun = psychologyAutoRun;
      }
      await settingsService.update(updateData);
    }

    return NextResponse.json({
      success: true,
      message: 'Psychology settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating psychology settings:', error);
    return NextResponse.json(
      { error: 'Failed to update psychology settings' },
      { status: 500 }
    );
  }
}