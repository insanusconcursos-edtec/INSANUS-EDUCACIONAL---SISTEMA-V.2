import { Topic, Module, Subject } from '../../types/curriculum';
import { ClassScheduleEvent } from '../../types/schedule';

export const resolveManualSchedule = (
  manualAppointments: any[],
  subjects: Subject[],
  topics: Topic[]
): ClassScheduleEvent[] => {
  // 1. Group appointments by Subject (subjectId)
  const appointmentsBySubject = manualAppointments.reduce((acc, curr) => {
    if (!acc[curr.subjectId]) acc[curr.subjectId] = [];
    acc[curr.subjectId].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  const appointmentsWithModules: ClassScheduleEvent[] = [];

  // 2. Process each subject separately
  for (const subjectId in appointmentsBySubject) {
    const subjectAppointments = appointmentsBySubject[subjectId];
    
    // 3. CHRONOLOGICAL SORTING (The Domino Effect)
    // Sort first by date and, in case of same date, by start time
    subjectAppointments.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      return dateA.getTime() - dateB.getTime();
    });

    // 4. MODULE ASSIGNMENT (Sliding Logic)
    // Build a flat list of all classes (modules/parts) for this subject
    const subjectTopics = topics
      .filter(t => t.subjectId === subjectId && t.isSelected)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const flatClasses: { topic: Topic; module: Module; partIndex: number; totalParts: number }[] = [];

    subjectTopics.forEach(topic => {
      if (topic.modules && topic.modules.length > 0) {
        topic.modules.forEach(module => {
          if (module.isSelected !== false && !module.isOnline) {
            for (let i = 0; i < module.classesCount; i++) {
              flatClasses.push({ topic, module, partIndex: i + 1, totalParts: module.classesCount });
            }
          }
        });
      } else if (topic.requiredClasses > 0) {
        const dummyModule: Module = {
          id: `topic-${topic.id}-general`,
          name: topic.name,
          classesCount: topic.requiredClasses,
          isSelected: true
        };
        for (let i = 0; i < topic.requiredClasses; i++) {
          flatClasses.push({ topic, module: dummyModule, partIndex: i + 1, totalParts: topic.requiredClasses });
        }
      }
    });

    let currentModuleIndex = 0; // Global pointer for classes/modules of this subject

    subjectAppointments.forEach((appointment, index) => {
      const assignedClass = flatClasses[currentModuleIndex];
      
      appointmentsWithModules.push({
        ...appointment,
        id: appointment.id || `manual-${appointment.date}-${appointment.startTime}-${index}`,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime || calculateEndTime(appointment.startTime, appointment.shift),
        teacherId: appointment.teacherId,
        subjectId: appointment.subjectId,
        topicId: assignedClass?.topic.id || 'extra',
        moduleId: assignedClass?.module.id || 'extra',
        moduleIndex: assignedClass ? `${assignedClass.partIndex}/${assignedClass.totalParts}` : 'Extra',
        meetingNumber: index + 1,
        isException: appointment.isException || appointment.isManual || false,
        isOverflow: !assignedClass,
        shift: appointment.shift,
        classId: appointment.classId || '',
        status: appointment.status || 'SCHEDULED',
        classOrderIndex: index + 1,
        isSubstitute: appointment.isSubstitute || false,
      });
      
      currentModuleIndex++; // Advance pointer to next chronological appointment
    });
  }

  // PASSO 2: CONTAGEM GLOBAL DE ENCONTROS (Nova Lógica)
  // 1. Ordena TODOS os agendamentos cronologicamente (Data e Hora)
  const sortedGlobalAppointments = [...appointmentsWithModules].sort((a, b) => {
    const timeA = new Date(`${a.date}T${a.startTime}`);
    const timeB = new Date(`${b.date}T${b.startTime}`);
    return timeA.getTime() - timeB.getTime();
  });

  let currentMeetingNumber = 0;
  let lastDateShiftKey = '';

  // 2. Itera e incrementa o encontro APENAS quando a Data ou o Turno mudarem
  const finalSchedule = sortedGlobalAppointments.map(app => {
    const currentDateShiftKey = `${app.date}-${app.shift}`; // Ex: '2026-03-21-Tarde'
    
    // Se mudou o dia OU mudou o turno no mesmo dia, é um novo encontro
    if (currentDateShiftKey !== lastDateShiftKey) {
      currentMeetingNumber++;
      lastDateShiftKey = currentDateShiftKey;
    }

    return {
      ...app,
      meetingNumber: currentMeetingNumber // Sobrescreve o número com a contagem global correta
    };
  });

  return finalSchedule;
};

const calculateEndTime = (startTime: string, shift: string): string => {
  // Simple calculation based on shift, or just add 1 hour if unknown
  if (!startTime) return '';
  const [hours, minutes] = startTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  
  // Assuming a standard class duration, e.g., 1 hour and 40 minutes (100 mins) or 50 mins
  // Let's just add 1 hour and 40 minutes as a default for now if not provided
  date.setMinutes(date.getMinutes() + 100);
  
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};
