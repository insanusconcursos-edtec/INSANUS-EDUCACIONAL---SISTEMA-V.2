export type FeedbackCategory = 'idea' | 'compliment' | 'complaint' | 'teacher_evaluation';

export interface Feedback {
  id: string;
  userId: string;
  userProfile: {
    name: string;
    email: string;
    photoUrl?: string;
  };
  productType: 'plano' | 'curso_online' | 'turma_presencial' | 'simulado' | 'evento_ao_vivo';
  productId: string;
  productName: string;
  category: FeedbackCategory;
  message: string;
  createdAt: number;
  // Exclusive for category === 'teacher_evaluation'
  teacherId?: string;
  teacherName?: string;
  rating?: number; // 0 a 10
}
