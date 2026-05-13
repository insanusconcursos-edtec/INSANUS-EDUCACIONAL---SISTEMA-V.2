
export const holidayService = {
  getHolidays: async (year: number = 2026): Promise<string[]> => {
    // Simulating API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Static list of holidays for 2026 (and potentially others if needed)
    // In a real application, this would fetch from a database based on the year
    const holidays = [
      `${year}-01-01`, // Confraternização Universal
      `${year}-02-17`, // Carnaval (Estimado)
      `${year}-04-03`, // Sexta-feira Santa (Estimado)
      `${year}-04-21`, // Tiradentes
      `${year}-05-01`, // Dia do Trabalho
      `${year}-09-07`, // Independência do Brasil
      `${year}-10-12`, // Nossa Senhora Aparecida
      `${year}-11-02`, // Finados
      `${year}-11-15`, // Proclamação da República
      `${year}-12-25`, // Natal
    ];

    return holidays;
  }
};
