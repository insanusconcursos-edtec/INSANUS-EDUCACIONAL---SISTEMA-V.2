export const formatSafeDateLocal = (dateString: string | undefined | null): string => {
  if (!dateString) return '';
  try {
    // Pega apenas a parte da data (YYYY-MM-DD) ignorando o tempo (T00:00:00Z)
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return dateString;
  } catch (error) {
    return dateString || '';
  }
};
