import { Class } from '../types/class';
import { Topic, Subject } from '../types/curriculum';
import { Teacher } from '../types/teacher';

const parseCurrency = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  // If it's a string like "50.00" (standard float format), parse directly
  if (/^\d+\.\d+$/.test(String(value))) {
    return parseFloat(String(value));
  }

  // Otherwise apply the Brazilian format logic (remove dots, replace comma with dot)
  // "1.000,50" -> "1000.50"
  const stringValue = String(value).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]+/g, "");
  const parsed = parseFloat(stringValue);
  return isNaN(parsed) ? 0 : parsed;
};

export const useFinancialCalculations = (
  cls: Class,
  topics: Topic[],
  subjects: Subject[],
  teachers: Teacher[]
) => {
  const getFinancialDiagnostics = () => {
    const teachersWithoutRate: string[] = [];
    const topicsWithoutModules: string[] = [];
    const selectedTopics = topics.filter(t => t.isSelected);

    selectedTopics.forEach(topic => {
      const modules = topic.modules || [];
      const activeModules = modules.filter(mod => mod.isSelected !== false);

      if (activeModules.length === 0) {
        topicsWithoutModules.push(topic.name);
      }

      // Identify responsible teacher
      let teacherId = topic.teacherId;
      if (!teacherId) {
        const subject = subjects.find(s => s.id === topic.subjectId);
        teacherId = subject?.defaultTeacherId;
      }

      if (teacherId) {
        const teacher = teachers.find(t => t.id === teacherId);
        
        // Determine correct rate based on class category
        const isEnem = cls.category?.toUpperCase().includes('ENEM') || cls.subcategory?.toUpperCase().includes('ENEM');
        let rawRate = 0;
        
        if (teacher) {
            if (isEnem) {
                rawRate = teacher.baseHourlyRateEnem || teacher.baseHourlyRateConcurso || 0;
            } else {
                rawRate = teacher.baseHourlyRateConcurso || teacher.baseHourlyRateEnem || 0;
            }
        }

        const teacherRate = parseCurrency(rawRate);
        
        if (!teacher || teacherRate <= 0) {
          if (teacher && !teachersWithoutRate.includes(teacher.name)) {
            teachersWithoutRate.push(teacher.name);
          }
        }
      }
    });

    return { teachersWithoutRate, topicsWithoutModules };
  };

  const calculateProjectedCost = () => {
    const safeConfig = cls.remunerationConfig || {
      mode: 'DYNAMIC',
      fixedHourlyRate: 0,
      recordingCommission: 0,
      substitutionCommission: 0,
      weekendCommission: 0
    };

    const selectedTopics = topics.filter(t => t.isSelected);
    let totalCost = 0;

    console.log('--- Financial Calculation Debug ---');
    console.log(`Calculation Mode: ${safeConfig.mode}`);

    selectedTopics.forEach(topic => {
      const modules = topic.modules || [];
      const activeModules = modules.filter(mod => mod.isSelected !== false);
      
      activeModules.forEach(module => {
        // a) Determine duration in hours
        // classesPerMeeting is how many classes fit in one meetingDuration
        // So duration of one class = meetingDuration / classesPerMeeting
        // Total duration = classesCount * (meetingDuration / classesPerMeeting)
        const durationInHours = (module.classesCount / (cls.classesPerMeeting || 1)) * cls.meetingDuration;

        // b) Identify responsible teacher
        let teacherId = topic.teacherId;
        if (!teacherId) {
          const subject = subjects.find(s => s.id === topic.subjectId);
          teacherId = subject?.defaultTeacherId;
        }

        // c) Define Base Hourly Rate
        let baseHourlyRate = 0;
        let teacherName = 'Unknown';

        if (safeConfig.mode === 'FIXED') {
          baseHourlyRate = parseCurrency(safeConfig.fixedHourlyRate);
        } else {
          // DYNAMIC
          const teacher = teachers.find(t => t.id === teacherId);
          if (teacher) {
              const isEnem = cls.category?.toUpperCase().includes('ENEM') || cls.subcategory?.toUpperCase().includes('ENEM');
              let rawRate = 0;
              if (isEnem) {
                  rawRate = teacher.baseHourlyRateEnem || teacher.baseHourlyRateConcurso || 0;
              } else {
                  rawRate = teacher.baseHourlyRateConcurso || teacher.baseHourlyRateEnem || 0;
              }
              baseHourlyRate = parseCurrency(rawRate);
              teacherName = teacher.name;
          }
        }

        // d) Apply Recording Commission
        let finalHourlyRate = baseHourlyRate;
        if (cls.hasRecordings && safeConfig.recordingCommission) {
          const commission = baseHourlyRate * (safeConfig.recordingCommission / 100);
          finalHourlyRate += commission;
        }

        // e) Multiply Rate by Duration
        const moduleCost = finalHourlyRate * durationInHours;
        totalCost += moduleCost;

        console.log(`Topic: ${topic.name} | Module: ${module.name}`);
        console.log(`  Duration: ${durationInHours.toFixed(2)}h | Teacher: ${teacherName} | Rate: R$${baseHourlyRate} | Cost: R$${moduleCost.toFixed(2)}`);
      });
    });
    
    console.log(`Total Projected Cost: R$${totalCost.toFixed(2)}`);
    console.log('-----------------------------------');

    return totalCost;
  };

  return { calculateProjectedCost, getFinancialDiagnostics };
};
