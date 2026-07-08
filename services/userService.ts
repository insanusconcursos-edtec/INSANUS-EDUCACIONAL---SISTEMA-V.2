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
  writeBatch,
  Timestamp,
  FieldValue
} from 'firebase/firestore';
import { db, auth as mainAuth, firebaseConfig } from './firebase';
import { toPlainObject } from './firestoreUtils';
import { LinkedResources } from '../types/product';

// === TYPES ===

export interface AccessItem {
  id: string; // Unique ID for this specific access grant
  type: 'plan' | 'simulated_class' | 'course' | 'presential_class' | 'live_events' | 'product' | 'presential_event';
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
  activePlanId?: string;
  planStats?: Record<string, { // Chave é o planId
    minutes: number;
    completedGoals?: number;
  }>;
  blocked?: boolean;
  blockReason?: string;
  isException?: boolean;
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
 * Updates student's login email on Firebase Authentication & Firestore synchronously using the backend Admin SDK.
 */
export const updateStudentEmailAdmin = async (uid: string, novoEmail: string): Promise<void> => {
  const response = await fetch('/api/admin/students/update-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, novoEmail }),
  });

  const text = await response.text();
  let resData;
  try {
    resData = JSON.parse(text);
  } catch (err) {
    throw new Error('Erro ao processar resposta do servidor.');
  }

  if (!response.ok || !resData.success) {
    throw new Error(resData.error || 'Erro ao sincronizar e-mail do aluno.');
  }
};

/**
 * Updates student's password on Firebase Authentication synchronously using the backend Admin SDK.
 */
export const updateStudentPasswordAdmin = async (uid: string, novaSenha: string): Promise<void> => {
  const response = await fetch('/api/admin/students/update-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, novaSenha }),
  });

  const text = await response.text();
  let resData;
  try {
    resData = JSON.parse(text);
  } catch (err) {
    throw new Error('Erro ao processar resposta do servidor.');
  }

  if (!response.ok || !resData.success) {
    throw new Error(resData.error || 'Erro ao atualizar senha do aluno.');
  }
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
    type: 'plan' | 'simulated_class' | 'course' | 'presential_class' | 'live_events' | 'presential_event'; 
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

const ensureDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
  if (typeof dateVal === 'string') return new Date(dateVal);
  return new Date();
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
      const currentEnd = ensureDate(item.diaFim);
      const now = new Date();
      const baseDate = currentEnd > now ? currentEnd : now; // If expired, start extension from now
      
      const newEnd = new Date(baseDate);
      newEnd.setDate(newEnd.getDate() + additionalDays);

      return { 
        ...item, 
        diaFim: Timestamp.fromDate(newEnd),
        days: (item.days || 0) + additionalDays,
        isActive: true // Reactivate if it was expired
      };
    }
    return item;
  });

  const updatedProducts = currentProducts.map(item => {
    if (item.id === accessId || (tictoIdToExtend && item.tictoId === tictoIdToExtend)) {
      const currentEnd = ensureDate(item.diaFim);
      const now = new Date();
      const baseDate = currentEnd > now ? currentEnd : now;
      
      const newEnd = new Date(baseDate);
      newEnd.setDate(newEnd.getDate() + additionalDays);

      return { 
        ...item, 
        diaFim: Timestamp.fromDate(newEnd),
        days: (item.days || 0) + additionalDays,
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
      const currentEnd = ensureDate(itemToExtend.diaFim);
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

export const updateStudentAccessDates = async (uid: string, accessId: string, startDate: Date, endDate: Date) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) throw new Error("Usuário não encontrado");

  const student = userSnap.data() as Student;
  const currentAccess = student.access || [];
  const currentProducts = student.products || [];

  const itemToUpdate = currentProducts.find(item => item.id === accessId) || currentAccess.find(item => item.id === accessId);
  if (!itemToUpdate) throw new Error("Acesso não encontrado");
  
  const tictoIdToUpdate = itemToUpdate.tictoId;

  // Calculate duration in days
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const updateItem = (item: AccessItem): AccessItem => {
    const isDirectMatch = item.id === accessId;
    const isTictoMatch = tictoIdToUpdate && item.tictoId === tictoIdToUpdate;
    const isLinkedMatch = item.sourceProductId === accessId;

    if (isDirectMatch || isTictoMatch || isLinkedMatch) {
      return {
        ...item,
        diaInicio: Timestamp.fromDate(startDate),
        diaFim: Timestamp.fromDate(endDate),
        days: diffDays > 0 ? diffDays : 0,
        isActive: endDate > new Date()
      };
    }
    return item;
  };

  const updatedAccess = currentAccess.map(updateItem);
  const updatedProducts = currentProducts.map(updateItem);

  await updateDoc(userRef, { 
    access: updatedAccess,
    products: updatedProducts
  });

  // Update enrollment if it's a course
  if (itemToUpdate.type === 'course') {
    try {
      const enrollmentId = `${itemToUpdate.targetId}_${uid}`;
      const enrollmentRef = doc(db, 'course_enrollments', enrollmentId);
      await updateDoc(enrollmentRef, {
        releasedAt: startDate.toISOString(),
        expiresAt: endDate.toISOString(),
        active: endDate > new Date()
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

export const updateUserActivePlan = async (uid: string, planId: string) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { 
    activePlanId: planId,
    updatedAt: serverTimestamp()
  });
};

/**
 * Sincroniza os recursos vinculados de um produto para todos os alunos que possuem o produto ativo.
 * Adiciona novos recursos e remove os que foram desvinculados.
 * Isso garante que ao editar um produto, todos os alunos ganhem ou percam acesso aos recursos automaticamente.
 */
export const syncProductResourcesForStudents = async (productId: string, newResources: LinkedResources) => {
  console.log(`[UserService] Iniciando sincronização de recursos para o produto ${productId}...`);
  
  // 1. Fetch de títulos para manter o AccessItem amigável e informativo
  const titlesMap: Record<string, string> = {};
  
  const fetchTitles = async (collectionName: string, ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const promises = ids.map(async (id) => {
      if (titlesMap[id]) return;
      try {
        const d = await getDoc(doc(db, collectionName, id));
        if (d.exists()) {
          const data = d.data();
          titlesMap[id] = data.title || data.name || 'Conteúdo Vinculado';
        }
      } catch (e) {
        console.error(`Erro ao buscar título para ${id} na coleção ${collectionName}`);
      }
    });
    await Promise.all(promises);
  };

  await Promise.all([
    fetchTitles('plans', newResources.plans || []),
    fetchTitles('courses', newResources.onlineCourses || []),
    fetchTitles('simulatedClasses', newResources.simulated || []),
    fetchTitles('classes', newResources.presentialClasses || []),
    fetchTitles('live_events', newResources.liveEvents || []),
    fetchTitles('presential_events', newResources.presentialEvents || [])
  ]);

  // 2. Fetch de todos os alunos (filtra por role student no Firestore se possível)
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', 'student'));
  const snapshot = await getDocs(q);
  const students = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Student));

  let batch = writeBatch(db);
  let batchCount = 0;
  const BATCH_LIMIT = 450; 

  const commitIfNeeded = async () => {
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  };

  for (const student of students) {
    const products = student.products || [];
    // Busca o item de acesso ao produto original
    const pAccess = products.find(p => p.targetId === productId && p.isActive);
    
    if (!pAccess) continue;

    const sourceId = pAccess.id;
    const currentAccess = student.access || [];

    // 1. Desativar recursos que foram removidos do produto
    const updatedAccess = currentAccess.map(access => {
      if (access.sourceProductId !== sourceId) return access;

      // Verifica se o recurso ainda está vinculado ao produto
      const isStillLinked = (
        (access.type === 'plan' && (newResources.plans || []).includes(access.targetId)) ||
        (access.type === 'course' && (newResources.onlineCourses || []).includes(access.targetId)) ||
        (access.type === 'simulated_class' && (newResources.simulated || []).includes(access.targetId)) ||
        (access.type === 'presential_class' && (newResources.presentialClasses || []).includes(access.targetId)) ||
        (access.type === 'live_events' && (newResources.liveEvents || []).includes(access.targetId)) ||
        (access.type === 'presential_event' && (newResources.presentialEvents || []).includes(access.targetId))
      );
      
      // Se não está mais vinculado e o acesso do aluno ainda estava ativo para este produto
      if (!isStillLinked && access.isActive) {
        // Se for curso, também desativamos a matrícula vinculada
        if (access.type === 'course') {
          const enrollmentId = `${access.targetId}_${student.uid}`;
          const enrollmentRef = doc(db, 'course_enrollments', enrollmentId);
          batch.update(enrollmentRef, { active: false, updatedAt: serverTimestamp() });
          batchCount++;
        }
        return { ...access, isActive: false };
      }
      return access;
    });

    // 2. Adicionar novos recursos que faltam
    const ensureAccess = async (type: AccessItem['type'], targetId: string) => {
      // Garante que não estouramos o lote durante a adição de um recurso
      await commitIfNeeded();

      // Verifica se o aluno já tem um acesso ATIVO para este recurso vindo deste produto
      const exists = updatedAccess.some(a => a.sourceProductId === sourceId && a.type === type && a.targetId === targetId && a.isActive);
      if (!exists) {
        const startsAt = pAccess.diaInicio;
        const endsAt = pAccess.diaFim;

        updatedAccess.push({
          id: crypto.randomUUID(),
          type,
          targetId,
          title: titlesMap[targetId] || 'Recurso Vinculado',
          days: pAccess.days,
          diaInicio: startsAt,
          diaFim: endsAt,
          isActive: true,
          sourceProductId: sourceId
        });

        // Se for curso, também criamos ou reativamos a matrícula vinculada
        if (type === 'course') {
          const enrollmentId = `${targetId}_${student.uid}`;
          const enrollmentRef = doc(db, 'course_enrollments', enrollmentId);
          batch.set(enrollmentRef, {
            id: enrollmentId,
            courseId: targetId,
            userId: student.uid,
            userName: student.name,
            userEmail: student.email,
            userCpf: student.cpf,
            userPhone: student.whatsapp || '',
            enrollmentType: 'REGULAR',
            releasedAt: startsAt.toDate ? startsAt.toDate().toISOString() : new Date().toISOString(),
            expiresAt: endsAt.toDate ? endsAt.toDate().toISOString() : new Date().toISOString(),
            active: true,
            createdAt: serverTimestamp(),
            sourceProductId: sourceId
          }, { merge: true });
          batchCount++;
        }
      }
    };

    for (const id of (newResources.plans || [])) {
      await ensureAccess('plan', id);
    }
    for (const id of (newResources.onlineCourses || [])) {
      await ensureAccess('course', id);
    }
    for (const id of (newResources.simulated || [])) {
      await ensureAccess('simulated_class', id);
    }
    for (const id of (newResources.presentialClasses || [])) {
      await ensureAccess('presential_class', id);
    }
    for (const id of (newResources.liveEvents || [])) {
      await ensureAccess('live_events', id);
    }
    for (const id of (newResources.presentialEvents || [])) {
      await ensureAccess('presential_event', id);
    }

    // Se houve mudança no array de acessos, atualiza o documento do aluno
    const hasAccessCountChanged = updatedAccess.length !== currentAccess.length;
    const hasStatusChanged = updatedAccess.some((a, i) => a.isActive !== currentAccess[i]?.isActive);

    if (hasAccessCountChanged || hasStatusChanged) {
      await commitIfNeeded();
      batch.update(doc(db, 'users', student.uid), { access: updatedAccess });
      batchCount++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  
  console.log(`[UserService] Sincronização concluída com sucesso.`);
};

export const blockStudent = async (uid: string, reason: string) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { blocked: true, blockReason: reason });
};

export const unblockStudent = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { blocked: false, blockReason: '' });
};

export const setExceptionStatus = async (uid: string, isException: boolean) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { isException });
};

export const userService = {
  createStudent,
  updateStudent,
  sendPasswordReset,
  deleteStudent,
  getStudents,
  getStudentById,
  grantStudentAccess,
  revokeStudentAccess,
  extendStudentAccess,
  updateStudentAccessDates,
  toggleCourseAccess,
  updateUserActivePlan,
  syncProductResourcesForStudents,
  blockStudent,
  unblockStudent,
  setExceptionStatus
};
