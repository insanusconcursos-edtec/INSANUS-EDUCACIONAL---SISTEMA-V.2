export interface TeacherFinancialReport {
  teacherId: string;
  name: string;
  totalEarnings: number;
  monthlyEarnings: { month: string; value: number }[];
  breakdown: {
    basePay: number;
    recordingBonus: number;
    weekendBonus: number;
    substitutionBonus: number;
    substitutionDeduction: number;
  };
}

export interface FinancialReport {
  classId: string;
  totalCost: number;
  monthlyData: {
    month: string;
    total: number;
    details: {
      base: number;
      recording: number;
      substitution: number;
      weekend: number;
    };
  }[];
  teacherReports: TeacherFinancialReport[];
}
