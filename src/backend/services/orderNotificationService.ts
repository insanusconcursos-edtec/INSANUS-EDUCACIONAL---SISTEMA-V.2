import { getAdminConfig } from './firebaseAdmin.js';
import { sendPushNotification } from './notificationAdminService.js';

/**
 * Initializes a listener on the 'orders' collection to send push notifications
 * when orders are created (PIX Generated) or paid (Sale Success).
 */
export const initOrderNotificationListener = () => {
  const { dbAdmin } = getAdminConfig();
  console.log('[Push Trigger] Inicializando listener de notificações para pedidos...');

  // Listen for changes in the 'orders' (or 'audit_splits' since orders might be in Pagarme but audit_splits is where we log them)
  // Actually, handlePagarmeWebhook already processes the update.
  // The user asked for a trigger ON the 'orders' collection.
  
  dbAdmin.collection('orders').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      const orderData = change.doc.data();
      const orderId = change.doc.id;

      if (change.type === 'added') {
        // Novo pedido
        if (orderData.payment_method === 'pix' && (orderData.status === 'pending' || orderData.status === 'waiting_payment')) {
          await notifyPixGenerated(orderData);
        } else if (orderData.status === 'paid' || orderData.status === 'success') {
          if (!orderData.notified_paid) {
            await notifySaleSuccess(orderData);
            await change.doc.ref.update({ notified_paid: true });
          }
        }
      }

      if (change.type === 'modified') {
        // Atualização de status
        if ((orderData.status === 'paid' || orderData.status === 'success')) {
           if (!orderData.notified_paid) {
             await notifySaleSuccess(orderData);
             await change.doc.ref.update({ notified_paid: true });
           }
        }
      }
    });
  }, (error) => {
    console.error('[Push Trigger] Erro no listener de ordens:', error);
  });
};

async function notifyPixGenerated(order) {
  const { dbAdmin } = getAdminConfig();
  const amount = (order.transaction_amount || order.amount || 0) / 100;
  const productName = order.description || order.metadata?.courseName || 'Produto';
  
  const title = "Pix Emitido! ⚡";
  const body = `Um PIX de R$ ${amount.toFixed(2)} foi gerado para o produto ${productName}`;

  // Buscar todos os envolvidos no split para notificar sobre a intenção de compra?
  // O usuário pediu: "Para cada 'recipient_id' no split, busque o 'fcmToken'".
  const splits = order.split || order.splits || [];
  
  for (const s of splits) {
    const userId = await findUserIdByRecipientId(s.recipient_id);
    if (userId) {
      await sendPushNotification(userId, title, body, `/admin/coproduction`);
    }
  }
}

async function notifySaleSuccess(order) {
  const { dbAdmin } = getAdminConfig();
  const productName = order.description || order.metadata?.courseName || 'Produto';
  const splits = order.split || order.splits || [];

  for (const s of splits) {
    const userId = await findUserIdByRecipientId(s.recipient_id);
    if (userId) {
      const splitVal = (s.amount || 0) / 100;
      const title = "Venda Realizada! 💰";
      const body = `Sua parte: R$ ${splitVal.toFixed(2)}. Produto: ${productName}`;
      await sendPushNotification(userId, title, body, `/admin/coproduction`);
    }
  }
}

async function findUserIdByRecipientId(recipientId: string): Promise<string | null> {
  const { dbAdmin } = getAdminConfig();
  try {
    const usersSnap = await dbAdmin.collection('users')
      .where('pagarmeRecipientId', '==', recipientId)
      .limit(1)
      .get();
    
    if (!usersSnap.empty) {
      return usersSnap.docs[0].id;
    }

    // Special case for Master if not found by recipientId (maybe master has a fixed UID)
    if (recipientId === 're_cmouicmz204gz0l9tyr4jkmut') {
        const masterSnap = await dbAdmin.collection('users')
            .where('email', '==', 'insanusconcursos@gmail.com')
            .limit(1)
            .get();
        if (!masterSnap.empty) return masterSnap.docs[0].id;
    }
  } catch (err) {
    console.error(`Erro ao buscar usuário para recipient ${recipientId}:`, err);
  }
  return null;
}
