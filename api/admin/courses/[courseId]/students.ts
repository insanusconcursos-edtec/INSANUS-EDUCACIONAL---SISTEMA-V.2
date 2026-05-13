import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as firebaseAdmin from 'firebase-admin';

// Tratamento para o empacotador da Vercel
const admin = firebaseAdmin.default || firebaseAdmin;

// Inicialização segura com Cold Start
try {
  if (!admin.apps?.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '')
      : undefined;

    if (privateKey && process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    }
  }
} catch (error) {
  console.error("Crash no Firebase Init:", error);
}

interface CourseAccess {
  id?: string;
  type: string;
  targetId: string;
  isActive?: boolean;
  diaFim?: any;
  diaInicio?: any;
}

interface UserProfile {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userCpf: string;
  userAvatar: string;
  enrollmentType?: string;
  accessOrigin?: string;
  expiresAt?: string | null;
  releasedAt?: string | null;
  active?: boolean;
  createdAt?: any;
}

interface Enrollment {
  id: string;
  userId?: string;
  enrollmentType?: string;
  expiresAt?: any;
  releasedAt?: any;
  createdAt?: any;
  active?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { courseId } = req.query;

    if (!courseId || typeof courseId !== 'string') {
      return res.status(400).json({ success: false, error: 'ID do curso inválido' });
    }

    const db = admin.firestore();

    // 1. Busca Matrículas Diretas (Coleção course_enrollments)
    const directEnrollmentsSnap = await db.collection('course_enrollments')
      .where('courseId', '==', courseId)
      .get();
    
    const directEnrollments = directEnrollmentsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 2. Busca Alunos para verificar acesso via Combo (Coleção users -> array access)
    // Buscamos alunos ativos para filtrar em memória os que possuem o curso no array 'access'
    const studentsSnap = await db.collection('users')
      .where('role', '==', 'student')
      .get();

    const studentMap = new Map<string, UserProfile>();

    // Parte A: Processar alunos que ganharam acesso via Combo/Produto
    studentsSnap.docs.forEach(doc => {
      const userData = doc.data();
      const accessArray = userData.access || [];
      
      // Verifica se existe um item de acesso do tipo 'course' para este courseId e que esteja ativo
      const courseAccess = accessArray.find((acc: CourseAccess) => 
        acc.type === 'course' && 
        acc.targetId === courseId && 
        acc.isActive === true
      );

      if (courseAccess) {
        studentMap.set(doc.id, {
          id: doc.id,
          userId: doc.id,
          userName: userData.name || userData.displayName || 'Sem Nome',
          userEmail: userData.email || '',
          userPhone: userData.phone || userData.whatsapp || userData.contact || '',
          userCpf: userData.cpf || '',
          userAvatar: userData.photoURL || '',
          enrollmentType: (courseAccess.id && String(courseAccess.id).startsWith('mig_')) ? 'MIGRACAO' : 'REGULAR',
          accessOrigin: (courseAccess.id && String(courseAccess.id).startsWith('mig_')) ? 'MIGRATION' : 'COMBO',
          expiresAt: courseAccess.diaFim ? (courseAccess.diaFim.toDate ? courseAccess.diaFim.toDate().toISOString() : courseAccess.diaFim) : null,
          releasedAt: courseAccess.diaInicio ? (courseAccess.diaInicio.toDate ? courseAccess.diaInicio.toDate().toISOString() : courseAccess.diaInicio) : (userData.createdAt?.toDate ? userData.createdAt.toDate().toISOString() : userData.createdAt),
          active: courseAccess.isActive !== false
        });
      }
    });

    // Parte B: Processar Matrículas Diretas (Sobrescrevendo ou complementando)
    for (const rawEnrollment of directEnrollments) {
      const enrollment = rawEnrollment as Enrollment;
      const userId = enrollment.userId;
      if (!userId) continue;

      let userProfile = studentMap.get(userId);
      
      if (!userProfile) {
        // Busca no snap de usuários carregados
        const userDoc = studentsSnap.docs.find(d => d.id === userId);
        if (userDoc) {
          const userData = userDoc.data();
          userProfile = { 
            id: userDoc.id,
            userId: userDoc.id,
            userName: userData.name || userData.displayName || 'Sem Nome',
            userEmail: userData.email || '',
            userPhone: userData.phone || userData.whatsapp || userData.contact || '',
            userCpf: userData.cpf || '',
            userAvatar: userData.photoURL || '',
            createdAt: userData.createdAt
          };
        } else {
          // Se não encontrou no snap (ex: role não é 'student'), busca no Firestore
          const docRef = await db.collection('users').doc(userId).get();
          if (docRef.exists) {
            const userData = docRef.data() || {};
            userProfile = { 
              id: docRef.id,
              userId: docRef.id,
              userName: userData.name || userData.displayName || 'Sem Nome',
              userEmail: userData.email || '',
              userPhone: userData.phone || userData.whatsapp || userData.contact || '',
              userCpf: userData.cpf || '',
              userAvatar: userData.photoURL || '',
              createdAt: userData.createdAt
            };
          }
        }
      }

      if (userProfile) {
        studentMap.set(userId, {
          ...userProfile,
          enrollmentType: enrollment.enrollmentType || 'REGULAR',
          accessOrigin: 'DIRECT',
          expiresAt: enrollment.expiresAt ? (enrollment.expiresAt.toDate ? enrollment.expiresAt.toDate().toISOString() : enrollment.expiresAt) : null,
          releasedAt: enrollment.releasedAt ? (enrollment.releasedAt.toDate ? enrollment.releasedAt.toDate().toISOString() : enrollment.releasedAt) : (enrollment.createdAt ? (enrollment.createdAt.toDate ? enrollment.createdAt.toDate().toISOString() : enrollment.createdAt) : (userProfile.createdAt?.toDate ? userProfile.createdAt.toDate().toISOString() : userProfile.createdAt)),
          active: enrollment.active !== false
        });
      }
    }

    const aggregatedStudents = Array.from(studentMap.values());

    // 6. Retorno
    return res.status(200).json({ success: true, students: aggregatedStudents });

  } catch (error) {
    console.error("Erro ao buscar alunos do curso:", error);
    return res.status(500).json({ success: false, error: 'Erro interno ao buscar alunos' });
  }
}
