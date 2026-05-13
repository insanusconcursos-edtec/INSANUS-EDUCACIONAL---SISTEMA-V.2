export const useClassCalculations = () => {
  const calculateNetClassTime = (
    meetingDurationHours: number,
    breakCount: number,
    breakDurationMinutes: number,
    classesPerMeeting: number
  ): number => {
    if (classesPerMeeting <= 0) return 0;
    
    const totalMeetingMinutes = meetingDurationHours * 60;
    
    // Regra ajustada: Tempo Líquido = (Total Encontro) / Qtd Aulas
    // O intervalo não é descontado da duração da aula, mas somado ao término do encontro.
    const netTime = totalMeetingMinutes / classesPerMeeting;
    
    return Math.max(0, Math.floor(netTime));
  };

  const calculateEndTime = (
    startTime: string,
    meetingDurationHours: number,
    breakCount: number = 0,
    breakDurationMinutes: number = 0
  ): string => {
    if (!startTime) return '';

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const totalMeetingMinutes = meetingDurationHours * 60;
    const totalBreakMinutes = breakCount * breakDurationMinutes;
    
    const totalMinutes = (startHour * 60) + startMinute + totalMeetingMinutes + totalBreakMinutes;
    
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;

    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  };

  return {
    calculateNetClassTime,
    calculateEndTime
  };
};
