'use client';

import { useState, useEffect } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';

interface DateRangePickerProps {
  vendorId: string;
  onSelect: (startDate: Date, endDate: Date, totalDays: number) => void;
  minDate?: Date;
  maxDate?: Date;
}

export default function DateRangePicker({ vendorId, onSelect, minDate, maxDate }: DateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const defaultMinDate = minDate || new Date(today.setDate(today.getDate() + 1));
  const defaultMaxDate = maxDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1));

  useEffect(() => {
    const fetchUnavailableDates = async () => {
      if (!vendorId) return;
      
      setLoading(true);
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      try {
        const response = await fetch(
          `/api/vendors/${vendorId}/availability?startDate=${startOfMonth.toISOString().split('T')[0]}&endDate=${endOfMonth.toISOString().split('T')[0]}`
        );
        const data = await response.json();
        setUnavailableDates(data.unavailableDates || []);
      } catch (error) {
        console.error('Error fetching availability:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUnavailableDates();
  }, [currentMonth, vendorId]);

  const isDateUnavailable = (date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    if (unavailableDates.includes(dateStr)) return true;
    if (date < defaultMinDate) return true;
    if (date > defaultMaxDate) return true;
    return false;
  };

  const isDateInRange = (date: Date): boolean => {
    if (!startDate) return false;
    if (startDate && endDate) {
      return date >= startDate && date <= endDate;
    }
    return false;
  };

  const handleDateClick = (date: Date) => {
    if (isDateUnavailable(date)) return;
    
    if (!startDate || (startDate && endDate)) {
      // Start new selection
      setStartDate(date);
      setEndDate(null);
    } else {
      // Complete selection
      let start = new Date(startDate);
      let end = new Date(date);
      
      if (start > end) {
        [start, end] = [end, start];
      }
      
      // Check if any date in range is unavailable
      let hasUnavailable = false;
      let current = new Date(start);
      while (current <= end && !hasUnavailable) {
        if (isDateUnavailable(current)) {
          hasUnavailable = true;
        }
        current.setDate(current.getDate() + 1);
      }
      
      if (hasUnavailable) {
        alert('Some dates in your selection are already booked. Please adjust your dates.');
        return;
      }
      
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      setEndDate(end);
      onSelect(start, end, totalDays);
    }
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push(prevDate);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  };

  const formatDateRange = (): string => {
    if (!startDate) return 'Select dates';
    if (startDate && !endDate) return `${startDate.toLocaleDateString()} - ?`;
    if (startDate && endDate) {
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()} (${days} days)`;
    }
    return 'Select dates';
  };

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      {/* Selected range display */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-indigo-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatDateRange()}
            </span>
          </div>
          {(startDate || endDate) && (
            <button
              onClick={handleClear}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          ←
        </button>
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          →
        </button>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="text-center py-4">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
        
        {getDaysInMonth(currentMonth).map((date, idx) => {
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isUnavailable = isDateUnavailable(date);
          const isInRange = isDateInRange(date);
          const isStart = startDate && date.toDateString() === startDate.toDateString();
          const isEnd = endDate && date.toDateString() === endDate.toDateString();
          
          let bgColor = '';
          if (isStart || isEnd) bgColor = 'bg-indigo-600 text-white';
          else if (isInRange) bgColor = 'bg-indigo-100 dark:bg-indigo-900/30';
          else if (isUnavailable) bgColor = 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed';
          
          return (
            <button
              key={idx}
              onClick={() => handleDateClick(date)}
              disabled={isUnavailable}
              className={`
                h-10 rounded-lg text-sm font-medium transition-colors
                ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900 dark:text-white'}
                ${bgColor}
                ${!isUnavailable && !isStart && !isEnd ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                ${isUnavailable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30"></div>
          <span>In range</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
          <span>Booked</span>
        </div>
      </div>
    </div>
  );
}