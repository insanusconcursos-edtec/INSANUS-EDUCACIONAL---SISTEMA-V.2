
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  limit,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { ExamQuestion, SimulatedExam } from './simulatedService';
import { Student, updateStudent } from './userService';

export interface SimulatedAttempt {
  id?: string;
  userId: string;
  userPhoto?: string;
  userName: string; // Snapshot do nome/apelido no momento da prova
  simulatedId: string;
  simulatedTitle: string;
  classId?: string; // ID da turma
  userAnswers: Record<number, string>; // { 1: 'A', 2: 'C' }
  score: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  totalQuestions: number;
  isApproved: boolean;
  completedAt: any;
  autodiagnosis?: {
    analysis: Record<string, {
      strong: number;
      review: number;
      weak: number;
      topicsToStudy: string[];
      topicsToReview: string[];
    }>;
  };
}

/**
 * Verifica se o usuário já realizou este simulado.
 */
export const checkExistingAttempt = async (userId: string, simulatedId: string): Promise<SimulatedAttempt | null> => {
  const q = query(
    collection(db, 'simulated_attempts'),
    where('userId', '==', userId),
    where('simulatedId', '==', simulatedId),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SimulatedAttempt;
  }
  return null;
};

/**
 * Calcula a nota e salva a tentativa.
 */
export const submitExamAttempt = async (
  user: { uid: string; name: string; photoURL?: string; nickname?: string },
  exam: SimulatedExam,
  userAnswers: Record<number, string>,
  classId?: string
): Promise<SimulatedAttempt> => {
  
  console.log("Submitting attempt for:", user.name, "Exam:", exam.title);

  // 1. Verificação de Segurança (Duplicidade)
  const existing = await checkExistingAttempt(user.uid, exam.id!);
  if (existing) {
    throw new Error("Você já realizou este simulado.");
  }

  // 2. Cálculo da Nota
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let score = 0;

  const correctAnswersMap = new Map<number, string>();
  if (exam.questions) {
    exam.questions.forEach(q => correctAnswersMap.set(q.index, q.answer));
  }

  // Itera sobre o total de questões do simulado
  for (let i = 1; i <= exam.questionCount; i++) {
    // Normalização da chave (aceita number ou string)
    const userAnswer = userAnswers[i] || userAnswers[String(i)];
    const correctAnswer = correctAnswersMap.get(i);
    const questionData = exam.questions?.find(q => q.index === i);

    // Se a questão foi anulada, conta como ponto para todos (Acerto Automático)
    if (questionData?.isAnnulled) {
        correct++;
        score += 1;
        continue;
    }

    if (!userAnswer) {
        blank++;
        // Em branco não pontua nem penaliza
    } else if (userAnswer === correctAnswer) {
        correct++;
        score += 1; // +1 Ponto por acerto
    } else {
        wrong++;
        // Lógica de Penalidade (Estilo Cespe)
        if (exam.hasPenalty) {
            score -= 1; // -1 Ponto por erro
        }
    }
  }

  // 3. Aprovação e Nota Líquida
  // Permite nota negativa (padrão Cespe)
  const maxPoints = exam.questionCount;
  
  // Percentual para aprovação
  // Nota: Se a nota for negativa, consideramos 0 para efeito de % de aproveitamento visual,
  // mas o score salvo pode ser negativo. Para aprovação, score >= minPoints.
  // Cálculo de aprovação baseado em percentual do total de questões
  const minScore = (exam.minApprovalPercent / 100) * maxPoints;
  const isApproved = score >= minScore;

  // 4. Preparar Nome de Exibição
  // Lógica: Se tem nickname, usa. Senão, usa Nome.
  const displayName = (user.nickname && user.nickname.trim().length > 0)
      ? user.nickname 
      : user.name;

  // 5. Preparar Objeto
  const attempt: SimulatedAttempt = {
    userId: user.uid,
    userPhoto: user.photoURL || '',
    userName: displayName,
    simulatedId: exam.id!,
    simulatedTitle: exam.title,
    classId: classId || '',
    userAnswers,
    score: Number(score.toFixed(2)), // Fix decimal
    correctCount: correct,
    wrongCount: wrong,
    blankCount: blank,
    totalQuestions: exam.questionCount,
    isApproved,
    completedAt: serverTimestamp()
  };

  console.log("Calculated Attempt Data:", attempt);

  // 6. Salvar no Firestore
  const docRef = await addDoc(collection(db, 'simulated_attempts'), attempt);
  
  // 7. Atualizar Nível de Preparação se for Simulado de Nivelamento
  if (exam.isLeveling) {
    const percent = (correct / exam.questionCount) * 100;
    let newLevel: 'beginner' | 'intermediate' | 'advanced' | 'insane' = 'beginner';
    
    if (percent > 90) newLevel = 'insane';
    else if (percent >= 71) newLevel = 'advanced';
    else if (percent >= 51) newLevel = 'intermediate';
    // Else stays beginner (< 51%)

    try {
      await updateStudent(user.uid, { studentLevel: newLevel });
      console.log("Student level updated to:", newLevel);
    } catch (e) {
      console.error("Error updating student level:", e);
    }
  }

  return { ...attempt, id: docRef.id };
};

/**
 * Busca o ranking de um simulado específico.
 */
export const getExamRanking = async (simulatedId: string): Promise<SimulatedAttempt[]> => {
  const q = query(
    collection(db, 'simulated_attempts'),
    where('simulatedId', '==', simulatedId),
    orderBy('score', 'desc'),
    orderBy('completedAt', 'asc'), // Desempate por quem fez primeiro
    limit(100) // Top 100
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimulatedAttempt));
};

/**
 * Busca todas as tentativas de um usuário específico.
 */
export const getAttemptsByUserId = async (userId: string): Promise<SimulatedAttempt[]> => {
  const q = query(
    collection(db, 'simulated_attempts'),
    where('userId', '==', userId),
    orderBy('completedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimulatedAttempt));
};
