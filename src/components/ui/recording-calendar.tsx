'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RecordingCalendarProps {
  recordingDates: string[]; // Array of dates in YYYY-MM-DD format
  onDateSelect: (date: string) => void;
  className?: string;
}

export function RecordingCalendar({ recordingDates, onDateSelect, className }: RecordingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Get current month and year
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Create a Set for faster lookup of recording dates
  const recordingDateSet = useMemo(() => new Set(recordingDates), [recordingDates]);
  
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
  
  // Handle date click
  const handleDateClick = (day: number) => {
    const dateString = formatDateString(currentYear, currentMonth, day);
    onDateSelect(dateString);
  };
  
  // Get month name
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentDate);
  
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
    <div className={cn("bg-white rounded-2xl border border-border overflow-hidden buzz-shadow-sm", className)}>
      {/* Calendar Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary">
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
          <div key={`day-${index}`} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {dayName}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="h-12 border-r border-b border-border/30" />;
          }
          
          const hasRecording = hasRecordings(currentYear, currentMonth, day);
          const isToday = new Date().toDateString() === new Date(currentYear, currentMonth, day).toDateString();
          
          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              className={cn(
                // Base styles - 44px+ touch target with Design Buzz spacing
                "h-12 border-r border-b border-border/30 relative flex items-center justify-center",
                "text-sm font-medium transition-all duration-200",
                "hover:bg-secondary active:scale-95",
                // Today indicator using accent color
                isToday && "bg-accent",
                // Recording status colors using semantic Design Buzz colors
                hasRecording 
                  ? "text-foreground hover:bg-accent" 
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {/* Day number */}
              <span className={cn(
                "relative z-10",
                isToday && "font-bold"
              )}>
                {day}
              </span>
              
              {/* Recording indicator dot using semantic colors */}
              <div className={cn(
                "absolute bottom-1 left-1/2 transform -translate-x-1/2",
                "w-1.5 h-1.5 rounded-full transition-all duration-200",
                hasRecording ? "bg-green-500" : "bg-red-500"
              )} />
              
            </button>
          );
        })}
      </div>
      
      {/* Legend using semantic color hierarchy */}
      <div className="px-4 py-3 bg-secondary border-t border-border">
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-muted-foreground">Has recordings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-muted-foreground">No recordings</span>
          </div>
        </div>
      </div>
    </div>
  );
}