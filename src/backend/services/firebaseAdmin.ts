import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Inicialização Lazy do Firebase Admin SDK.
 * Evita erros de múltiplas inicializações e garante compatibilidade com ambiente Node.js/Serverless.
 */
export const getAdminConfig = () => {
  if (getApps().length === 0) {
    try {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      
      // Limpeza da chave privada para evitar erros de formatação no ambiente Vercel
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
        console.warn('Aviso: Variáveis de ambiente do Firebase Admin não estão totalmente configuradas.');
      }

      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log('Firebase Admin inicializado com sucesso.');
    } catch (error) {
      console.error('Falha crítica ao inicializar Firebase Admin:', error);
      throw error;
    }
  }
  
  return { 
    dbAdmin: getFirestore(), 
    authAdmin: getAuth(),
    messagingAdmin: getMessaging()
  };
};
