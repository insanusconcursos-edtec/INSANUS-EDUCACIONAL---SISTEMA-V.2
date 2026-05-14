import { useState, useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth, messaging } from '../services/firebase';

export const usePushNotifications = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !messaging) return;

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        // VAPID KEY OFICIAL (Encontrada no Console Firebase > Messaging > Web Configuration)
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });

        if (token) {
          setFcmToken(token);
          await saveTokenToFirestore(token);
          console.log('[FCM] Client Token:', token);
        }
      }
    } catch (error) {
      console.error('[FCM] Erro ao obter permissão:', error);
    }
  };

  const saveTokenToFirestore = async (token: string) => {
    if (!auth.currentUser) return;
    
    console.log(`FCM Token gerado: ${token}`);

    try {
      // 1. Update in users collection
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        fcmToken: token,
        fcmLastUpdated: new Date().toISOString()
      });

      // 2. Update in coproducers collection (checking by email if doc ID is email)
      const userEmail = auth.currentUser.email;
      if (userEmail) {
        try {
          const coproducerRef = doc(db, 'coproducers', userEmail);
          await updateDoc(coproducerRef, {
            fcmToken: token,
            fcmLastUpdated: new Date().toISOString()
          });
        } catch (err) {
          // If doc by email doesn't exist, try by UID
          try {
            const coproducerRefByUid = doc(db, 'coproducers', auth.currentUser.uid);
            await updateDoc(coproducerRefByUid, {
              fcmToken: token,
              fcmLastUpdated: new Date().toISOString()
            });
          } catch (err2) {
            console.log('[FCM] Documento não encontrado na coleção coproducers por email ou UID');
          }
        }
      }
    } catch (err) {
      console.error('[FCM] Erro ao salvar no Firestore:', err);
    }
  };

  useEffect(() => {
    if (auth.currentUser) {
      requestPermission();
    }

    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground Message:', payload);
      if (Notification.permission === 'granted' && payload.notification) {
        new Notification(payload.notification.title || 'Venda!', {
          body: payload.notification.body,
          icon: '/icon-192x192.png'
        });
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  return { fcmToken, notificationPermission, requestPermission };
};
