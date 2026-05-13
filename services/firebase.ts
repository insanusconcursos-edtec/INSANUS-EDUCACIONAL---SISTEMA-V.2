
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getMessaging } from 'firebase/messaging';

// CONFIGURAÇÃO OFICIAL (Validada pelo Console)
export const firebaseConfig = {
  apiKey: "AIzaSyCDAzfb5nHdg8hGPnq-g0S4ojT_lSHmdD4",
  authDomain: "planner-insanus---v2.firebaseapp.com",
  projectId: "planner-insanus---v2",
  storageBucket: "planner-insanus---v2.firebasestorage.app",
  messagingSenderId: "853047463220",
  appId: "1:853047463220:web:4d1f72aa5a197c49256961",
  measurementId: "G-BEMKNR8JWJ"
};

// Inicialização dos serviços
const app = initializeApp(firebaseConfig);

// Exportando instâncias para uso no resto da app
export const auth = getAuth(app);

// MUDANÇA: Usamos initializeFirestore em vez de getFirestore
// Isso força o uso de cache local e conexão via polling (mais estável para evitar erros de WebChannel)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true, // Elimina o erro de WebChannel/Transport
});

export const storage = getStorage(app);
export const analytics = getAnalytics(app);

// Adicionando suporte a Mensagens (Messaging)
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

console.log("Firebase conectado com sucesso: ", firebaseConfig.projectId);

export default app;
