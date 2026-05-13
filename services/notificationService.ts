import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export const requestNotificationPermission = async (userId: string) => {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Permissão de notificação concedida.');
      
      // Obter o token FCM
      const token = await getToken(messaging, {
        vapidKey: 'BIsW9_uX3_R0pX3_example_key_please_check_console' // TODO: Substituir pela chave VAPID real se necessário
      });

      if (token) {
        console.log('FCM Token:', token);
        // Salvar o token no Firestore
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          fcmToken: token,
          notificationsEnabled: true,
          lastTokenUpdate: new Date()
        });
      } else {
        console.log('Nenhum token FCM disponível. Verifique as permissões.');
      }
    } else {
      console.log('Permissão de notificação negada.');
    }
  } catch (error) {
    console.error('Erro ao solicitar permissão de notificação:', error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      console.log('Mensagem recebida no foreground:', payload);
      resolve(payload);
    });
  });
