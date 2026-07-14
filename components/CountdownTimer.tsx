// components/CountdownTimer.tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface CountdownTimerProps {
  targetDate: string | Date;
  targetTime?: string;
}

export default function CountdownTimer({ targetDate, targetTime }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      let eventDateTime: Date | null = null;

      try {
        // If targetDate is a string
        if (typeof targetDate === 'string') {
          // Check if the string already contains a time (ISO format)
          if (targetDate.includes('T')) {
            // Format: "2026-07-04T14:00:00.000Z"
            eventDateTime = new Date(targetDate);
          } 
          // Check if it's just a date string
          else if (targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Format: "2026-07-04" + time
            if (targetTime) {
              eventDateTime = new Date(`${targetDate}T${targetTime}`);
            }
          }
          // Try other formats
          else {
            eventDateTime = new Date(targetDate);
          }
        } 
        // If targetDate is already a Date object
        else if (targetDate instanceof Date) {
          eventDateTime = new Date(targetDate);
        }

        // If still invalid, try manual parsing
        if (!eventDateTime || isNaN(eventDateTime.getTime())) {
          // Try parsing from string
          if (typeof targetDate === 'string') {
            // Try to extract date parts
            const dateMatch = targetDate.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatch) {
              const year = parseInt(dateMatch[1]);
              const month = parseInt(dateMatch[2]) - 1;
              const day = parseInt(dateMatch[3]);
              
              let hours = 0, minutes = 0;
              if (targetTime) {
                const timeParts = targetTime.split(':');
                hours = parseInt(timeParts[0]) || 0;
                minutes = parseInt(timeParts[1]) || 0;
              }
              
              eventDateTime = new Date(year, month, day, hours, minutes);
            }
          }
        }

        if (!eventDateTime || isNaN(eventDateTime.getTime())) {
          console.error('❌ [Countdown] Could not parse date:', targetDate, targetTime);
          return { days: 0, hours: 0, minutes: 0, seconds: 0 };
        }

        const now = new Date();
        const difference = eventDateTime.getTime() - now.getTime();

        if (difference <= 0) {
          setIsPast(true);
          return { days: 0, hours: 0, minutes: 0, seconds: 0 };
        }

        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      } catch (error) {
        console.error('❌ [Countdown] Error:', error);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, targetTime]);

  // Check if all values are zero
  const allZero = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (isPast) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
        <p className="text-red-600 dark:text-red-400 font-semibold">Event has already passed</p>
      </div>
    );
  }

  const timeUnits = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
      <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium text-center mb-3">
        ⏰ Event Starts In
      </p>
      <div className="grid grid-cols-4 gap-3">
        {timeUnits.map((unit, index) => (
          <motion.div
            key={unit.label}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className="text-center"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3">
              <span className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {String(unit.value).padStart(2, "0")}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{unit.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}