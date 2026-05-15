import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  getDoc,
  serverTimestamp,
  Timestamp,
  FieldValue
} from 'firebase/firestore';
import { db, auth as mainAuth, firebaseConfig } from './firebase';
import { toPlainObject } from './firestoreUtils';

// === TYPES ===

export interface AccessItem {
  id: string; // Unique ID for this specific access grant
  type: 'plan' | 'simulated_class' | 'course' | 'presential_class' | 'live_events' | 'product';
  targetId: string; // The ID of the Plan, Simulated Class, Course or Product
  title: string;
  days: number;
  diaInicio: Timestamp;
  diaFim: Timestamp;
  isActive: boolean;
  isScholarship?: boolean;
  tictoId?: string;
  sourceProductId?: string; // ID do Produto (Combo) que deu origem a este acesso
}

export interface UserCourseAccess {
  courseId: string;
  expiresAt: string; // ISO String
  active: boolean;
}

export interface Student {
  uid: string;
  name: string;
  email: string;
  cpf: string;
  whatsapp?: string;
  role: 'student';
  status?: 'active' | 'inactive';
  createdAt?: Timestamp | FieldValue;
  photoURL?: string;
  photoUrl?: string;
  photo?: string;
  allowManualGeneration?: boolean;
  access: AccessItem[];
  products?: AccessItem[]; // Array of products (combos) released to the user
  courses?: UserCourseAccess[]; // Separate array for Online Courses (Legacy/Alternative)
  isolatedProducts?: string[]; // Array of isolated product IDs (e.g., live events)
  
  // Statistics
  lifetimeMinutes?: number; // Tempo total acumulado na vida (minutos)
  studentLevel?: 'beginner' | 'intermediate' | 'advanced' | 'insane';
  currentPlanId?: string;
  planStats?: Record<string, { // Chave é o planId
    minutes: number;
    completedGoals?: number;
  }>;
}

export interface CreateStudentData {
  name: string;
  email: string;
  cpf: string;
  password?: string; // Optional if we auto-generate
  whatsapp?: string;
}

// === MAIN OPERATIONS ===

/**
 * Creates a student user in Auth and Firestore without logging out the current admin.
 * Uses the "Secondary App" pattern.
 */
export const createStudent = async (data: CreateStudentData): Promise<string> => {
  // 1. Initialize a secondary app to avoid logging out the admin
  const secondaryApp = initializeApp(firebaseConfig, "Secondary");
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // 2. Create User in Auth
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth, 
      data.email, 
      data.password || '123456' // Default password if not provided
    );
    const uid = userCredential.user.uid;

    // 3. Create User Document in Firestore (Using MAIN db instance)
    const newStudent: Student = {
      uid,
      name: data.name.toUpperCase(),
      email: data.email,
      cpf: data.cpf.replace(/\D/g, ''), // Remove non-digits
      whatsapp: data.whatsapp || '',
      role: 'student',
      createdAt: serverTimestamp(),
      access: [], // Starts with no access
      courses: [],
      lifetimeMinutes: 0,
      planStats: {}
    };

    await setDoc(doc(db, 'users', uid), newStudent);

    // 4. Cleanup Secondary Session
    await signOut(secondaryAuth);
    
    return uid;

  } catch (error: unknown) {
    console.error("Error creating student:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro ao criar aluno.";
    throw new Error(errorMessage);
  } finally {
    // 5. Delete Secondary App to free resources
    await deleteApp(secondaryApp);
  }
};

/**
 * Updates student profile data
 */
export const updateStudent = async (uid: string, data: Partial<Student>) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, data);
};

/**
 * Sends a password reset email
 */
export const sendPasswordReset = async (email: string) => {
  try {
    await sendPasswordResetEmail(mainAuth, email);
  } catch (error: unknown) {
    console.error("Reset Password Error:", error);
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as { code: string };
      if (authError.code === 'auth/user-not-found') {
        throw new Error('Usuário não encontrado no sistema de autenticação.');
      }
      if (authError.code === 'auth/invalid-email') {
        throw new Error('E-mail inválido.');
      }
    }
    throw new Error('Erro ao enviar e-mail de redefinição. Tente novamente.');
  }
};

/**
 * Deletes a student ONLY if they have no active access.
 * Note: This only deletes from Firestore. Auth deletion requires Cloud Functions or Admin SDK.
 */
export const deleteStudent = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("Usuário não encontrado.");
  }

  const userData = userSnap.data() as Student;
  
  // Check for active access
  const hasActiveAccess = userData.access?.some(item => item.isActive);
  const hasActiveCourses = userData.courses?.some(item => item.active);

  if (hasActiveAccess || hasActiveCourses) {
    throw new Error("Não é possível excluir: O aluno possui acessos ativos (Planos, Simulados ou Cursos). Revogue os acessos antes de excluir.");
  }

  await deleteDoc(userRef);
};

/**
 * Fetches all students. 
 * Note: Filtering by text (name/email/cpf) is done client-side 
 * because Firestore doesn't support 'LIKE' queries natively.
 */
export const getStudents = async (): Promise<Student[]> => {
  const q = query(
    collection(db, 'users'), 
    where('role', '==', 'student'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => toPlainObject({
    ...doc.data(),
    uid: doc.id
  }) as Student);
};

/**
 * Fetches a single student by ID.
 * Useful for refreshing data after updates.
 */
export const getStudentById = async (uid: string): Promise<Student | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return toPlainObject({ ...docSnap.data(), uid: docSnap.id }) as Student;
  }
  return null;
};

// === ACCESS MANAGEMENT ===

export const grantStudentAccess = async (
  uid: string, 
  data: { 
    type: 'plan' | 'simulated_class' | 'course' | 'presential_class' | 'live_events'; 
    targetId: string; 
    title: string; 
    days: number;
    isScholarship?: boolean;
  }
) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) throw new Error("Usuário não encontrado");

  const student = userSnap.data() as Student;
  const currentAccess = student.access || [];

  // Calculate Dates
  const diaInicio = new Date();
  const diaFim = new Date();
  diaFim.setDate(diaInicio.getDate() + data.days);

  const newAccessItem: AccessItem = {
    id: crypto.randomUUID(),
    type: data.type,
    targetId: data.targetId,
    title: data.title,
    days: data.days,
    diaInicio: Timestamp.fromDate(diaInicio),
    diaFim: Timestamp.fromDate(diaFim),
    isActive: true,
    isScholarship: data.isScholarship || false
  };

  // Replace existing if needed or push new
  // Usually we push new, but logic might vary. Here we append.
  const updatedAccess = [...currentAccess, newAccessItem];

  await updateDoc(userRef, { access: updatedAccess });

  // --- NEW: ADICIONAR AO COURSE_ENROLLMENTS SE FOR CURSO ---
  if (data.type === 'course') {
    try {
      const enrollmentId = `${data.targetId}_${uid}`;
      const enrollmentRef = doc(db, 'course_enrollments', enrollmentId);
      
      await setDoc(enrollmentRef, {
        id: enrollmentId,
        courseId: data.targetId,
        userId: uid,
        userName: student.name,
        userEmail: student.email,
        userCpf: student.cpf,
        userPhone: student.whatsapp || '',
        enrollmentType: data.isScholarship ? 'BOLSISTA' : 'REGULAR',
        releasedAt: diaInicio.toISOString(),
        expiresAt: diaFim.toISOString(),
        active: true,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao criar registro de matrícula:", error);
      // Não falhamos a operação principal se a matrícula falhar, 
      // mas logamos o erro.
    }
  }
};

export const revokeStudentAccess = async (uid: string, accessId: string) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;

  const student = userSnap.data() as Student;
  const currentAccess = (student.access || []) as AccessItem[];
  const currentProducts = (student.products || []) as AccessItem[];

  const itemToRevoke = currentProducts.find(item => item.id === accessId) || currentAccess.find(item => item.id === accessId);
  if (!itemToRevoke) return;

  const tictoIdToRevoke = itemToRevoke?.tictoId;
  const idsToRemove = [itemToRevoke.targetId];

  // 1. Identificação de Combos e Busca de Recursos Vinculados (Cascata)
  if (itemToRevoke.type === 'product') {
    try {
      const productSnap = await getDoc(doc(db, 'ticto_products', itemToRevoke.targetId));
      if (productSnap.exists()) {
        const productData = productSnap.data();
        const linked = productData.linkedResources;
        if (linked) {
          if (linked.plans) idsToRemove.push(...linked.plans);
          if (linked.onlineCourses) idsToRemove.push(...linked.onlineCourses);
          if (linked.presentialClasses) idsToRemove.push(...linked.presentialClasses);
          if (linked.simulated) idsToRemove.push(...linked.simulated);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar recursos vinculados do combo:", error);
    }
  }

  // 2. Filtro em Cascata (O Expurgo)
  // Removemos todos os itens cujo targetId esteja na lista de remoção ou compartilhe o mesmo tictoId,
  // ou que tenha o itemToRevoke.id como sourceProductId.
  const updatedAccess = currentAccess.map(item => {
    const isDirectMatch = idsToRemove.includes(item.targetId);
    const isSourceMatch = item.sourceProductId === itemToRevoke.id;
    const isTictoMatch = tictoIdToRevoke && item.tictoId === tictoIdToRevoke;

    if (isDirectMatch || isSourceMatch || isTictoMatch) {
      return { ...item, isActive: false };
    }
    return item;
  });

  const updatedProducts = currentProducts.map(item => {
    const isDirectMatch = idsToRemove.includes(item.targetId);
    const isSourceMatch = item.sourceProductId === itemToRevoke.id;
    const isTictoMatch = tictoIdToRevoke && item.tictoId === tictoIdToRevoke;

    if (isDirectMatch || isSourceMatch || isTictoMatch) {
      return { ...item, isActive: false };
    }
    return item;
  });

  await updateDoc(userRef, { 
    access: updatedAccess,
    products: updatedProducts
  });

  // --- NEW: REMOVER DO COURSE_ENROLLMENTS SE FOR CURSO ---
  if (itemToRevoke.type === 'course') {
    try {
      const enrollmentId = `${itemToRevoke.targetId}_${uid}`;
      await deleteDoc(doc(db, 'course_enrollments', enrollmentId));
    } catch (error) {
      console.error("Erro ao remover registro de matrícula:", error);
    }
  }
};

export const extendStudentAccess = async (uid: string, accessId: string, additionalDays: number) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;

  const student = userSnap.data() as Student;
  const currentAccess = student.access || [];
  const currentProducts = student.products || [];

  const itemToExtend = currentProducts.find(item => item.id === accessId) || currentAccess.find(item => item.id === accessId);
  const tictoIdToExtend = itemToExtend?.tictoId;

  const updatedAccess = currentAccess.map(item => {
    if (item.id === accessId || (tictoIdToExtend && item.tictoId === tictoIdToExtend)) {
      // Calculate new end date based on current end date (or now if expired)
      const currentEnd = item.diaFim.toDate();
      const now = new Date();
      const baseDate = currentEnd > now ? currentEnd : now; // If expired, start extension from now
      
      const newEnd = new Date(baseDate);
      newEnd.setDate(newEnd.getDate() + additionalDays);

      return { 
        ...item, 
        diaFim: Timestamp.fromDate(newEnd),
        days: item.days + additionalDays,
        isActive: true // Reactivate if it was expired
      };
    }
    return item;
  });

  const updatedProducts = currentProducts.map(item => {
    if (item.id === accessId || (tictoIdToExtend && item.tictoId === tictoIdToExtend)) {
      const currentEnd = item.diaFim.toDate();
      const now = new Date();
      const baseDate = currentEnd > now ? currentEnd : now;
      
      const newEnd = new Date(baseDate);
      newEnd.setDate(newEnd.getDate() + additionalDays);

      return { 
        ...item, 
        diaFim: Timestamp.fromDate(newEnd),
        days: item.days + additionalDays,
        isActive: true
      };
    }
    return item;
  });

  await updateDoc(userRef, { 
    access: updatedAccess,
    products: updatedProducts
  });

  // --- NEW: ATUALIZAR COURSE_ENROLLMENTS SE FOR CURSO ---
  if (itemToExtend && itemToExtend.type === 'course') {
    try {
      const enrollmentId = `${itemToExtend.targetId}_${uid}`;
      const enrollmentRef = doc(db, 'course_enrollments', enrollmentId);
      
      // Calculate new end date again for the enrollment record
      const currentEnd = itemToExtend.diaFim.toDate();
      const now = new Date();
      const baseDate = currentEnd > now ? currentEnd : now;
      const newEnd = new Date(baseDate);
      newEnd.setDate(newEnd.getDate() + additionalDays);

      await updateDoc(enrollmentRef, {
        expiresAt: newEnd.toISOString(),
        active: true
      });
    } catch (error) {
      console.error("Erro ao atualizar registro de matrícula:", error);
    }
  }
};

// --- CURSOS ONLINE ACCESS ---

export const toggleCourseAccess = async (uid: string, courseAccess: UserCourseAccess) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data() as Student;
      const currentCourses = userData.courses || [];
      
      // Remove a entrada antiga do curso (se existir)
      const otherCourses = currentCourses.filter(c => c.courseId !== courseAccess.courseId);
      
      // Adiciona a nova entrada com o status atualizado
      // Se a intenção for remover completamente do array quando inativo, descomente a lógica abaixo.
      // Mas para manter histórico e apenas marcar como inativo, mantemos o objeto.
      const newCourses = [...otherCourses, courseAccess];

      await updateDoc(userRef, { courses: newCourses });
    }
  } catch (error) {
    console.error("Erro ao atualizar acesso ao curso:", error);
    throw error;
  }
};
