export const calculateMultiPeriodTimes = (
  initialStartTime: string, 
  numberOfPeriods: number, 
  classDurationMinutes: number, // Duração de 1 tempo de aula (Ex: 90min)
  intervalMinutes: number // Duração do intervalo (Ex: 15min)
) => {
  const periods = [];
  let currentStart = new Date(`1970-01-01T${initialStartTime}:00`);

  for (let i = 1; i <= numberOfPeriods; i++) {
    // Calcula o término do tempo atual
    const currentEnd = new Date(currentStart.getTime() + classDurationMinutes * 60000);
    
    periods.push({
      periodNumber: i,
      startTime: currentStart.toTimeString().substring(0, 5),
      endTime: currentEnd.toTimeString().substring(0, 5)
    });

    // Para o próximo tempo, adiciona o intervalo
    currentStart = new Date(currentEnd.getTime() + intervalMinutes * 60000);
  }
  
  return periods;
};
