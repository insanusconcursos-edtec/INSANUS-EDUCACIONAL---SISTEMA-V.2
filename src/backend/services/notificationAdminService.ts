import { getAdminConfig } from './firebaseAdmin.js';

export const sendPushNotification = async (userId: string, title: string, body: string, url: string = '/') => {
  const { dbAdmin, messagingAdmin } = getAdminConfig();

  try {
    // 1. Buscar o FCM Token do usuário
    const userDoc = await dbAdmin.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`[Push] Usuário ${userId} não encontrado.`);
      return;
    }

    const userData = userDoc.data();
    const token = userData?.fcmToken;

    if (!token) {
      console.log(`[Push] Usuário ${userId} não possui FCM Token cadastrado.`);
      return;
    }

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
