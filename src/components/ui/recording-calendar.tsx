'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RecordingCalendarProps {
  recordingDates: string[]; // Array of dates in YYYY-MM-DD format
  dateFileCounts: Record<string, number>; // File count per date
  onDateSelect: (date: string) => void;
  className?: string;
}

export function RecordingCalendar({
  recordingDates,
  dateFileCounts,
  onDateSelect,
  className,
}: RecordingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get current month and year
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Create a Set for faster lookup of recording dates
  const recordingDateSet = useMemo(
    () => new Set(recordingDates),
    [recordingDates],
  );

  // Get first day of month and number of days in month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const firstDayWeekday = firstDayOfMonth.getDay(); // 0 = Sunday

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Format date to YYYY-MM-DD
  const formatDateString = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Check if a date has recordings
  const hasRecordings = (year: number, month: number, day: number) => {
    const dateString = formatDateString(year, month, day);
    return recordingDateSet.has(dateString);
  };

  // Get file count for a specific date
  const getFileCount = (year: number, month: number, day: number) => {
    const dateString = formatDateString(year, month, day);
    return dateFileCounts[dateString] || 0;
  };

  // Check if a date is in the future
  const isFutureDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    return date > today;
  };

  // Handle date click
  const handleDateClick = (day: number) => {
    // Don't allow clicking on future dates
    if (isFutureDate(currentYear, currentMonth, day)) {
      return;
    }
    const dateString = formatDateString(currentYear, currentMonth, day);
    onDateSelect(dateString);
  };

  // Get month name
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
    currentDate,
  );

  // Day names
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Generate calendar grid
  const calendarDays = [];

  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className={cn('standard-card overflow-hidden', className)}>
      {/* Calendar Header */}
      <div className="border-b border-border bg-secondary px-4 py-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousMonth}
            className="h-8 w-8 p-0 hover:bg-background"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </Button>

          <div className="font-semibold text-foreground">
            {monthName} {currentYear}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextMonth}
            className="h-8 w-8 p-0 hover:bg-background"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </Button>
        </div>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 border-b border-border">
        {dayNames.map((dayName, index) => (
          <div
            key={`day-${index}`}
            className="p-2 text-center text-xs font-medium text-muted-foreground"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                className="h-12 border-b border-r border-border/30"
              />
            );
          }

          const hasRecording = hasRecordings(currentYear, currentMonth, day);
          const fileCount = getFileCount(currentYear, currentMonth, day);
          const isToday =
            new Date().toDateString() ===
            new Date(currentYear, currentMonth, day).toDateString();
          const isFuture = isFutureDate(currentYear, currentMonth, day);

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              disabled={isFuture}
              className={cn(
                // Base styles - 44px+ touch target
                'relative flex h-12 items-center justify-center border-b border-r border-gray-300',
                'text-sm font-medium transition-all duration-200',
                // Square background colors
                !isFuture && hasRecording
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : !isFuture
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'cursor-not-allowed bg-gray-100 text-gray-300',
                // Today indicator - black border
                isToday && !isFuture && 'ring-2 ring-inset ring-black',
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  'relative z-10 font-semibold',
                  isToday && !isFuture && 'font-bold',
                )}
              >
                {day}
              </span>

              {/* File count dots - only show for past/present dates with recordings */}
              {!isFuture && fileCount > 0 && (
                <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 transform gap-0.5">
                  {Array.from({ length: Math.min(fileCount, 5) }, (_, i) => (
                    <div key={i} className="h-1 w-1 rounded-full bg-black" />
                  ))}
                  {fileCount > 5 && (
                    <div className="ml-0.5 text-[8px] font-bold text-black">
                      +{fileCount - 5}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="border-t border-gray-300 bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="flex h-4 w-4 items-center justify-center rounded bg-green-500">
              <div className="h-1 w-1 rounded-full bg-black"></div>
            </div>
            <span className="text-gray-700">Has recordings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-red-500"></div>
            <span className="text-gray-700">No recordings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-1 rounded-full bg-black"></div>
            <span className="text-gray-700">= 1 file</span>
          </div>
        </div>
      </div>
    </div>
  );
}
