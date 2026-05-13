import { Class } from '../../types/class';

export interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  meetingNumber: number;
  slotIndex: number;
  isReserve: boolean;
}

const addMinutes = (time: string, minutes: number): string => {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
};

const getDayName = (date: Date): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

export const generateEmptySlots = (classData: Class, holidays: string[]): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const startDate = new Date(classData.startDate + 'T00:00:00'); // Ensure local time interpretation
  const endDate = classData.endDate ? new Date(classData.endDate + 'T00:00:00') : null;
  const totalMeetings = classData.totalMeetings;
  
  // Convert meeting duration from hours to minutes
  const meetingDurationMinutes = classData.meetingDuration * 60;
  const slotDuration = meetingDurationMinutes / classData.classesPerMeeting;

  const currentDate = new Date(startDate);
  let meetingsCount = 0;

  // Loop with a safety margin to allow overflow logic
  // We generate extra slots beyond the official totalMeetings to accommodate all content
  const safetyMargin = 100;
  const maxMeetingsToGenerate = totalMeetings + safetyMargin;

  while (meetingsCount < maxMeetingsToGenerate) {
    // We no longer break on endDate to allow overflow scheduling
    // if (endDate && currentDate > endDate) { break; }

    const dateString = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay(); // 0-6
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.includes(dateString);

    // Check if we should skip this day based on holidays
    if (isHoliday && classData.holidaysOff) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
    }

    const meetingsToGenerate: { startTime: string; isReserve: boolean }[] = [];

    if (!isWeekend) {
        // Weekday logic
        if (classData.daysOfWeek.includes(dayOfWeek)) {
            meetingsToGenerate.push({ startTime: classData.startTime, isReserve: false });
        }
    } else {
        // Weekend logic
        const regularConfig = classData.regularWeekendConfigs?.find(c => c.dayOfWeek === dayOfWeek);
        const reserveConfig = classData.weekendConfigs?.find(c => c.dayOfWeek === dayOfWeek);

        // 1. Regular Weekend Configs
        if (regularConfig && regularConfig.shifts.length > 0) {
             regularConfig.shifts.forEach(shift => {
                meetingsToGenerate.push({ startTime: shift.startTime, isReserve: false });
             });
        }

        // 2. Reserve Weekend Configs (check for duplicates)
        if (classData.allowWeekend && reserveConfig && reserveConfig.shifts.length > 0) {
            reserveConfig.shifts.forEach(shift => {
                // Check if this shift is already present in the regular config for this day
                const isAlreadyRegular = regularConfig?.shifts.some(s => s.shift === shift.shift);
                
                if (!isAlreadyRegular) {
                    meetingsToGenerate.push({ startTime: shift.startTime, isReserve: true });
                }
            });
        }
    }

    // Sort meetings by time
    meetingsToGenerate.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Generate slots for each meeting found for this day
    for (const meeting of meetingsToGenerate) {
        meetingsCount++;
        
        if (meetingsCount > maxMeetingsToGenerate) break;

        let currentStartTime = meeting.startTime;

        for (let i = 0; i < classData.classesPerMeeting; i++) {
            // Add break duration if it's not the first class and breaks are enabled
            if (i > 0 && classData.hasBreak && classData.breakDuration > 0) {
                currentStartTime = addMinutes(currentStartTime, classData.breakDuration);
            }

            const endTime = addMinutes(currentStartTime, slotDuration);
            
            slots.push({
                date: dateString,
                startTime: currentStartTime,
                endTime: endTime,
                meetingNumber: meetingsCount,
                slotIndex: i + 1,
                isReserve: meeting.isReserve,
            });

            currentStartTime = endTime;
        }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
};
