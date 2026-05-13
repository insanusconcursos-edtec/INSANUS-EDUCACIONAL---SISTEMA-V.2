
import { 
  collection, 
  doc, 
  writeBatch, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  Timestamp, 
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

const cleanObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(cleanObject);
  }

  // Se não for um objeto simples (ex: Timestamp, FieldValue, Date), retorna como está
  if (Object.prototype.toString.call(obj) !== '[object Object]') {
    return obj;
  }
  
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      newObj[key] = cleanObject(obj[key]);
    }
  });
  return newObj;
};

import { getLocalISODate } from './scheduleService';

export interface CourseReview {
  id: string;
  userId: string;
  courseId?: string; // Opcional para suportar Planos
  planId?: string;   // Adicionado para suportar Planos
  disciplineId: string;
  disciplineName: string; 
  topicId: string;
  topicName: string;
  scheduledDate: string; 
  status: 'pending' | 'completed' | 'missed';
  reviewIndex: number;
  intervalDays: number;
  label: string;
  isLastOfCycle: boolean;
  repeatInterval: number | null;
  createdAt: Timestamp;
  completedAt?: any; // Timestamp
  
  // Novos campos para desacoplamento de metas
  type?: 'topic_revision' | 'goal_revision';
  goalType?: 'LEI SECA' | 'QUESTÕES' | 'RESUMO' | 'FLASHCARD';
  goalId?: string;
  metaTitle?: string;
}

export const courseReviewService = {
  // 1. Agenda as revisões com base nos intervalos
  scheduleReviews: async (
    userId: string, 
    courseId: string | null, // Pode ser null se for Plano
    disciplineId: string, 
    disciplineName: string, 
    topicId: string, 
    topicName: string, 
    intervals: number[], 
    repeatLast: boolean,
    planId?: string // Novo parâmetro opcional
  ) => {
    const batch = writeBatch(db);
    const reviewsRef = collection(db, 'users', userId, 'course_reviews');

    let currentDate = new Date();

    intervals.forEach((interval, index) => {
      currentDate = new Date(currentDate.getTime());
      currentDate.setDate(currentDate.getDate() + interval);
      
      const scheduledDateStr = getLocalISODate(currentDate);
      const isLast = index === intervals.length - 1;
      const newReviewRef = doc(reviewsRef);

      const reviewData: CourseReview = {
        id: newReviewRef.id,
        userId,
        courseId: courseId || undefined,
        planId: planId || undefined,
        disciplineId,
        disciplineName, 
        topicId,
        topicName,
        scheduledDate: scheduledDateStr,
        status: 'pending',
        reviewIndex: index + 1,
        intervalDays: interval,
        label: `REV. ${index + 1} - ${interval} DIA${interval > 1 ? 'S' : ''}`,
        isLastOfCycle: isLast,
        repeatInterval: isLast && repeatLast ? interval : null,
        createdAt: serverTimestamp(),
        type: 'topic_revision'
      };

      batch.set(newReviewRef, cleanObject(reviewData));
    });

    await batch.commit();
  },

  /**
   * 2. Busca revisões pendentes ou atrasadas de um curso OU plano específico
   */
  getPendingReviews: async (userId: string, targetId?: string, type: 'course' | 'plan' = 'course') => {
    const reviewsRef = collection(db, 'users', userId, 'course_reviews');
    
    let q;
    if (targetId) {
        const field = type === 'course' ? 'courseId' : 'planId';
        q = query(
            reviewsRef, 
            where(field, '==', targetId), 
            where('status', '!=', 'completed')
        );
    } else {
        q = query(
            reviewsRef, 
            where('status', '!=', 'completed')
        );
    }
    
    const snapshot = await getDocs(q);
    
    const reviews = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
    } as CourseReview));

    // Ordena pela data mais antiga primeiro (Client-side sort para evitar índice complexo composto)
    return reviews.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  },

  /**
   * 3. Busca revisões específicas de um Tópico (Para exibir no Edital)
   */
  getReviewsByTopic: async (userId: string, topicId: string) => {
    const reviewsRef = collection(db, 'users', userId, 'course_reviews');
    
    const q = query(
        reviewsRef, 
        where('topicId', '==', topicId)
    );
    
    const snapshot = await getDocs(q);
    
    const reviews = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
    } as CourseReview));

    // Ordena pelo índice da revisão (REV 1, REV 2...)
    return reviews.sort((a, b) => a.reviewIndex - b.reviewIndex);
  },

  /**
   * 4. Deleta todas as revisões de um tópico (Quando o aluno desmarca conclusão)
   */
  deleteReviewsByTopic: async (userId: string, topicId: string) => {
    const reviewsRef = collection(db, 'users', userId, 'course_reviews');
    const q = query(reviewsRef, where('topicId', '==', topicId));
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
  },

  /**
   * 5. Deleta todas as revisões de um plano (Quando o aluno reinicia o plano)
   */
  deleteReviewsByPlan: async (userId: string, planId: string) => {
    const reviewsRef = collection(db, 'users', userId, 'course_reviews');
    const q = query(reviewsRef, where('planId', '==', planId));
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
  },

  /**
   * 6. Conclui uma revisão e verifica se deve gerar a próxima (Loop Infinito)
   */
  completeReview: async (userId: string, review: CourseReview) => {
    const batch = writeBatch(db);
    
    // A. Atualiza o status da revisão atual
    const currentReviewRef = doc(db, 'users', userId, 'course_reviews', review.id);
    batch.update(currentReviewRef, cleanObject({ 
        status: 'completed',
        completedAt: serverTimestamp()
    }));

    // B. Se for a última do ciclo e tiver repetição ativada, cria a próxima
    if (review.isLastOfCycle && review.repeatInterval) {
        const nextDate = new Date(); // Data base é hoje (data da conclusão)
        nextDate.setDate(nextDate.getDate() + review.repeatInterval);
        
        const nextDateStr = getLocalISODate(nextDate);
        const newReviewRef = doc(collection(db, 'users', userId, 'course_reviews'));
        
        const newReviewData: CourseReview = {
            ...review,
            id: newReviewRef.id,
            scheduledDate: nextDateStr,
            status: 'pending',
            reviewIndex: review.reviewIndex + 1,
            label: `REV. ${review.reviewIndex + 1} - ${review.repeatInterval} DIAS`,
            createdAt: serverTimestamp(),
            completedAt: undefined // Limpa o campo de conclusão
        };

        batch.set(newReviewRef, cleanObject(newReviewData));
    }

    await batch.commit();
  },

  /**
   * 7. Deleta um lote de revisões órfãs (Self-healing)
   */
  cleanupOrphanedReviews: async (reviews: CourseReview[]) => {
    if (!reviews || reviews.length === 0) return;

    const batch = writeBatch(db);
    reviews.forEach(review => {
      // Usamos a referência direta se o review tiver userId e ID
      const reviewRef = doc(db, 'users', review.userId, 'course_reviews', review.id);
      batch.delete(reviewRef);
    });

    await batch.commit();
  }
};
