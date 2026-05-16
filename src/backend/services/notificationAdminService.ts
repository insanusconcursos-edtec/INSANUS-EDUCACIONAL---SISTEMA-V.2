import { getAdminConfig } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

export const sendPushNotification = async (userId: string, title: string, body: string, url: string = '/') => {
  const { dbAdmin, messagingAdmin } = getAdminConfig();
  let matchedDocRef: any = null;
  let token: string | null = null;

  try {
    // 1. Buscar o FCM Token (Tentar na coleção 'users' e 'coproducers')
    
    // Tentar na coleção users
    const userDocRef = dbAdmin.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data?.fcmToken) {
        token = data.fcmToken;
        matchedDocRef = userDocRef;
      }
    }

    // Se não encontrou, talvez o userId seja um email ou esteja na coleção coproducers
    if (!token) {
      const coproDocRef = dbAdmin.collection('coproducers').doc(userId);
      const coproDoc = await coproDocRef.get();
      if (coproDoc.exists) {
        const data = coproDoc.data();
        if (data?.fcmToken) {
          token = data.fcmToken;
          matchedDocRef = coproDocRef;
        }
      }
    }

    // Se ainda não encontrou e o userId parece um email, tentar buscar o usuário pelo campo email na coleção users
    if (!token && userId.includes('@')) {
      const userByEmail = await dbAdmin.collection('users').where('email', '==', userId).limit(1).get();
      if (!userByEmail.empty) {
        const doc = userByEmail.docs[0];
        if (doc.data()?.fcmToken) {
          token = doc.data().fcmToken;
          matchedDocRef = doc.ref;
        }
      }
    }

    // Se ainda não encontrou, tentar buscar na coleção coproducers pelo pagarmeRecipientId
    if (!token) {
      const coproByRecipient = await dbAdmin.collection('coproducers').where('pagarmeRecipientId', '==', userId).limit(1).get();
      if (!coproByRecipient.empty) {
        const doc = coproByRecipient.docs[0];
        if (doc.data()?.fcmToken) {
          token = doc.data().fcmToken;
          matchedDocRef = doc.ref;
        }
      }
    }

    if (!token) {
      console.log(`[Push] Token não encontrado para identificador: ${userId}`);
      return;
    }

    console.log(`[Push] Enviando notificação para o token: ${token}`);

    // 2. Enviar a mensagem via Firebase Admin
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        url,
      },
      token: token,
      android: {
        priority: 'high',
        notification: {
          icon: 'stock_ticker_update',
          color: '#4ade80'
        }
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          icon: 'https://insanusconcursos.com/wp-content/uploads/2026/05/LOGO-MOBILE-2-INSANUS.png',
          badge: 'https://insanusconcursos.com/wp-content/uploads/2026/05/LOGO-MOBILE-2-INSANUS.png'
        }
      }
    };

    try {
      const response = await messagingAdmin.send(message as any);
      console.log(`[Push] Notificação enviada com sucesso para o usuário ${userId}:`, response);
      return response;
    } catch (sendError: any) {
      const isInvalidToken = 
        sendError.code === 'messaging/registration-token-not-registered' || 
        (sendError.message && sendError.message.includes('Requested entity was not found'));

      if (isInvalidToken && matchedDocRef) {
        await matchedDocRef.update({
          fcmToken: FieldValue.delete()
        });
        console.log(`🧹 [FCM] Token fantasma removido para o usuário de ID: ${userId}`);
        return;
      }

      throw sendError;
    }
  } catch (error: any) {
    // Silencia o log se o erro for de token não registrado (caso tenha escapado do catch interno ou ocorrido erro na busca)
    const isInvalidToken = 
      error.code === 'messaging/registration-token-not-registered' || 
      (error.message && error.message.includes('Requested entity was not found'));

    if (!isInvalidToken) {
      console.error(`[Push] Erro ao enviar notificação para o usuário ${userId}:`, error);
    }
  }
};
