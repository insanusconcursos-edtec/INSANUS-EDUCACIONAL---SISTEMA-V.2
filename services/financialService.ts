import { Class } from '../types/class';
import { ClassScheduleEvent } from '../types/schedule';
import { Teacher } from '../types/teacher';
import { FinancialReport, TeacherFinancialReport } from '../types/financial';
import { parseISO, format, getDay, differenceInMinutes } from 'date-fns';

export const calculateFinancialReport = (
  classData: Class,
  events: ClassScheduleEvent[],
  teachers: Teacher[]
): FinancialReport => {
  const teacherReportsMap = new Map<string, TeacherFinancialReport>();
  const monthlyDataMap = new Map<string, {
    total: number;
    details: { base: number; recording: number; substitution: number; weekend: number };
  }>();

  let totalCost = 0;

  // Helper to get or create teacher report
  const getTeacherReport = (teacherId: string): TeacherFinancialReport => {
    if (!teacherReportsMap.has(teacherId)) {
      const teacher = teachers.find(t => t.id === teacherId);
      teacherReportsMap.set(teacherId, {
        teacherId,
        name: teacher?.name || 'Professor Desconhecido',
        totalEarnings: 0,
        monthlyEarnings: [],
        breakdown: {
          basePay: 0,
          recordingBonus: 0,
          weekendBonus: 0,
          substitutionBonus: 0,
          substitutionDeduction: 0
        }
      });
    }
    return teacherReportsMap.get(teacherId)!;
  };

  // Helper to get or create monthly data
  const getMonthlyData = (monthKey: string) => {
    if (!monthlyDataMap.has(monthKey)) {
      monthlyDataMap.set(monthKey, {
        total: 0,
        details: { base: 0, recording: 0, substitution: 0, weekend: 0 }
      });
    }
    return monthlyDataMap.get(monthKey)!;
  };

  // Helper to update monthly earnings in teacher report
  const updateTeacherMonthlyEarnings = (teacherId: string, monthKey: string, value: number) => {
    const report = getTeacherReport(teacherId);
    const monthEntry = report.monthlyEarnings.find(m => m.month === monthKey);
    if (monthEntry) {
      monthEntry.value += value;
    } else {
      report.monthlyEarnings.push({ month: monthKey, value });
    }
  };

  // Helper to calculate duration in hours
  const calculateDurationInHours = (startTime: string, endTime: string): number => {
      const start = parseISO(`2000-01-01T${startTime}`);
      const end = parseISO(`2000-01-01T${endTime}`);
      return differenceInMinutes(end, start) / 60;
  };

  // Helper to get base rate
  const getBaseRate = (teacherId: string): number => {
      if (classData.remunerationConfig?.mode === 'FIXED') {
          return classData.remunerationConfig.fixedHourlyRate || 0;
      }
      const teacher = teachers.find(t => t.id === teacherId);
      if (!teacher) return 0;
      
      const isEnem = classData.category?.toUpperCase().includes('ENEM') || 
                     classData.subcategory?.toUpperCase().includes('ENEM');
      
      return isEnem 
        ? (teacher.baseHourlyRateEnem || 0) 
        : (teacher.baseHourlyRateConcurso || 0);
  };

  events.forEach(event => {
    if (event.status === 'CANCELED') return;

    const duration = calculateDurationInHours(event.startTime, event.endTime);
    const monthKey = format(parseISO(event.date), 'yyyy-MM');
    const isWeekend = [0, 6].includes(getDay(parseISO(event.date)));

    const currentTeacherId = event.teacherId;
    const originalTeacherId = event.originalTeacherId;
    
    const currentTeacherReport = getTeacherReport(currentTeacherId);
    const monthlyStats = getMonthlyData(monthKey);

    // 1. Base Pay
    const baseRate = getBaseRate(currentTeacherId);
    const basePay = baseRate * duration;

    currentTeacherReport.totalEarnings += basePay;
    currentTeacherReport.breakdown.basePay += basePay;
    updateTeacherMonthlyEarnings(currentTeacherId, monthKey, basePay);
    
    monthlyStats.total += basePay;
    monthlyStats.details.base += basePay;
    totalCost += basePay;

    // 2. Recording Bonus
    if (classData.hasRecordings && classData.remunerationConfig?.recordingCommission) {
        const bonus = basePay * (classData.remunerationConfig.recordingCommission / 100);
        
        currentTeacherReport.totalEarnings += bonus;
        currentTeacherReport.breakdown.recordingBonus += bonus;
        updateTeacherMonthlyEarnings(currentTeacherId, monthKey, bonus);

        monthlyStats.total += bonus;
        monthlyStats.details.recording += bonus;
        totalCost += bonus;
    }

    // 3. Weekend Bonus
    if (isWeekend && classData.remunerationConfig?.weekendCommission) {
        const bonus = basePay * (classData.remunerationConfig.weekendCommission / 100);
        
        currentTeacherReport.totalEarnings += bonus;
        currentTeacherReport.breakdown.weekendBonus += bonus;
        updateTeacherMonthlyEarnings(currentTeacherId, monthKey, bonus);

        monthlyStats.total += bonus;
        monthlyStats.details.weekend += bonus;
        totalCost += bonus;
    }

    // 4. Substitution Logic
    if (event.isSubstitute && classData.remunerationConfig?.substitutionCommission) {
        // A. Credit Substitute (Current Teacher)
        const subBonus = basePay * (classData.remunerationConfig.substitutionCommission / 100);
        
        currentTeacherReport.totalEarnings += subBonus;
        currentTeacherReport.breakdown.substitutionBonus += subBonus;
        updateTeacherMonthlyEarnings(currentTeacherId, monthKey, subBonus);

        monthlyStats.total += subBonus;
        monthlyStats.details.substitution += subBonus;
        totalCost += subBonus;

        // B. Debit Original Teacher
        if (originalTeacherId) {
            const originalTeacherReport = getTeacherReport(originalTeacherId);
            
            // Calculate what the original teacher WOULD have earned as base
            const originalBaseRate = getBaseRate(originalTeacherId);
            const originalBasePay = originalBaseRate * duration;
            
            const deduction = originalBasePay * (classData.remunerationConfig.substitutionCommission / 100);

            originalTeacherReport.totalEarnings -= deduction;
            originalTeacherReport.breakdown.substitutionDeduction += deduction;
            updateTeacherMonthlyEarnings(originalTeacherId, monthKey, -deduction);
            
            monthlyStats.total -= deduction;
            monthlyStats.details.substitution -= deduction; 
            totalCost -= deduction;
        }
    }
  });

  // Convert maps to arrays
  const monthlyData = Array.from(monthlyDataMap.entries()).map(([month, data]) => ({
    month,
    ...data
  })).sort((a, b) => a.month.localeCompare(b.month));

  const teacherReports = Array.from(teacherReportsMap.values());

  return {
    classId: classData.id,
    totalCost,
    monthlyData,
    teacherReports
  };
};
