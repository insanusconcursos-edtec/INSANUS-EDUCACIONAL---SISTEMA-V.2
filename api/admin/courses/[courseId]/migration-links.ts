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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Validar método (POST para criar link)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Extrair courseId da query e os dados (validade, dias) do req.body
    const { courseId } = req.query;
    const { expiresAt, accessDurationDays } = req.body;

    if (!courseId || typeof courseId !== 'string') {
      return res.status(400).json({ success: false, error: 'ID do curso inválido' });
    }

    const db = admin.firestore();

    // 3. Executar a lógica de negócio (gerar link e salvar no Firestore)
    const newLink = {
      courseId,
      expiresAt,
      accessDurationDays: Number(accessDurationDays),
      active: true,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('MigrationLinks').add(newLink);
    
    // 4. Retornar os dados do link para o frontend
    // Nota: O link retornado é relativo, o frontend completa com o origin
    return res.status(201).json({ 
      success: true, 
      id: docRef.id,
      link: `/migracao/${docRef.id}`
    });

  } catch (error) {
    console.error("Erro ao gerar link de migração:", error);
    return res.status(500).json({ success: false, error: 'Erro interno ao gerar link' });
  }
}
