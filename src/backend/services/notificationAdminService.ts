import { getAdminConfig } from './firebaseAdmin.js';

export const sendPushNotification = async (userId: string, title: string, body: string, url: string = '/') => {
  const { dbAdmin, messagingAdmin } = getAdminConfig();

  try {
    // 1. Buscar o FCM Token (Tentar na coleção 'users' e 'coproducers')
    let token: string | null = null;
    
    // Tentar na coleção users
    const userDoc = await dbAdmin.collection('users').doc(userId).get();
    if (userDoc.exists) {
      token = userDoc.data()?.fcmToken;
    }

    // Se não encontrou, talvez o userId seja um email ou esteja na coleção coproducers
    if (!token) {
      const coproDoc = await dbAdmin.collection('coproducers').doc(userId).get();
      if (coproDoc.exists) {
        token = coproDoc.data()?.fcmToken;
      }
    }

    // Se ainda não encontrou e o userId parece um email, tentar buscar o usuário pelo campo email na coleção users
    if (!token && userId.includes('@')) {
      const userByEmail = await dbAdmin.collection('users').where('email', '==', userId).limit(1).get();
      if (!userByEmail.empty) {
        token = userByEmail.docs[0].data()?.fcmToken;
      }
    }

    // Se ainda não encontrou, tentar buscar na coleção coproducers pelo pagarmeRecipientId
    if (!token) {
      const coproByRecipient = await dbAdmin.collection('coproducers').where('pagarmeRecipientId', '==', userId).limit(1).get();
      if (!coproByRecipient.empty) {
        token = coproByRecipient.docs[0].data()?.fcmToken;
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

    const response = await messagingAdmin.send(message as any);
    console.log(`[Push] Notificação enviada com sucesso para o usuário ${userId}:`, response);
    return response;
  } catch (error) {
    console.error(`[Push] Erro ao enviar notificação para o usuário ${userId}:`, error);
  }
};
