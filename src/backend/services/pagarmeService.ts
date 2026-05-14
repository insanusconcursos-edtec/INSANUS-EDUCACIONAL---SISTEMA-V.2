import axios from 'axios';
import { provisionPurchase } from './provisioningService.js';
import { getAdminConfig } from './firebaseAdmin.js';
import { sendPushNotification } from './notificationAdminService.js';

// CONFIGURAÇÃO GLOBAL DA API V5
const PAGARME_BASE_URL = 'https://api.pagar.me/core/v5';
const MASTER_RECIPIENT_ID = 're_cmouicmz204gz0l9tyr4jkmut';

/**
 * Helper para Autenticação Basic com Base64
 * Padrão Pagar.me: Basic base64(sk_test_...:)
 */
const getHeaders = () => {
  const secretKey = (process.env.PAGARME_SECRET_KEY || '').trim();
  if (!secretKey) throw new Error('PAGARME_SECRET_KEY não encontrada no ambiente.');
  
  const auth = Buffer.from(`${secretKey}:`).toString('base64');
  return {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

/**
 * Cálculo de Taxas Pagar.me (em centavos)
 * Baseado no manual oficial e solicitação do usuário.
 */
const calculatePagarmeFees = (amountCents: number, method: string, installments: number = 1): number => {
  let fee = 0;
  if (method === 'pix') {
    fee = Math.round(amountCents * 0.02); // 2%
  } else if (method === 'ticket' || method === 'boleto') {
    fee = 319; // R$ 3,19 fixo
  } else if (method === 'credit_card') {
    let rate = 0.0245; // 2.45% base
    if (installments >= 2 && installments <= 6) rate = 0.03;
    else if (installments >= 7) rate = 0.035;
    fee = Math.round(amountCents * rate) + 80;
  }
  return fee;
};

/**
 * CRIAÇÃO DE PEDIDO (ORDER) - API V5
 * Foco total em reconstruir o Split de PIX e Cartão.
 */
export const createPagarmeOrder = async (orderData: any, initialCoproducers: any[] = []) => {
  const { dbAdmin } = getAdminConfig();
  console.log(`[PAGARME V5] Injetando Split Rules para: ${orderData.description}`);

  const productId = orderData.metadata?.courseId || orderData.productId;
  const offerId = orderData.metadata?.offerId;
  const paymentMethod = orderData.payment_method === 'ticket' ? 'boleto' : orderData.payment_method;
  
  // ---------------------------------------------------------
  // 1. REGRAS DE OURO DO SPLIT (PRIORIDADE TOTAL)
  // ---------------------------------------------------------
  let coproducers = [...initialCoproducers];
  let affiliateRecipientId: string | null = null;
  let affiliatePercent = 0;

  try {
    // Busca id do Afiliado primeiro
    const refId = orderData.metadata?.refId;
    if (refId) {
      const affUser = await dbAdmin.collection('users').doc(refId).get();
      if (affUser.exists && affUser.data()?.pagarmeRecipientId) {
        affiliateRecipientId = affUser.data()?.pagarmeRecipientId;
      }
    }

    // Busca regras no Produto (Afiliado % e Coprodutores Adicionais)
    if (productId) {
      const productDoc = await dbAdmin.collection('ticto_products').doc(productId).get();
      if (productDoc.exists) {
        const productData = productDoc.data();
        const offersArray = productData?.offers || [];
        const currentOffer = offersArray.find((o: any) => String(o.id) === String(offerId));

        if (currentOffer && currentOffer.isAffiliationEnabled) {
          affiliatePercent = Number(currentOffer.affiliateCommission) || 0;
        }

        // Se não vieram coprodutores do handler, pegamos do produto
        if (coproducers.length === 0) {
          const coproSource = currentOffer?.coproducers || productData?.coproduction || productData?.coproducers || [];
          if (Array.isArray(coproSource)) {
            coproducers = coproSource.map((c: any) => ({
              recipientId: c.pagarmeRecipientId || c.recipientId,
              percentage: Number(c.percentage) || 0
            })).filter(c => c.recipientId && c.percentage > 0);
          }
        }
      }
    }
  } catch (err) {
    console.error('[SPLIT] Erro ao buscar regras:', err);
  }

  // 2. MONTAGEM DO OBJETO SPLITS (CÁLCULO LÍQUIDO)
  const amountCents = Math.round(Number(orderData.transaction_amount) * 100);
  const pagarmeFees = calculatePagarmeFees(amountCents, paymentMethod, orderData.installments || 1);
  const pool = amountCents - pagarmeFees;

  const splitArray: any[] = [];
  let distributed = 0;

  // Afiliado (Sobre pool)
  if (affiliateRecipientId && affiliatePercent > 0) {
    const val = Math.floor(pool * (affiliatePercent / 100));
    splitArray.push({
      recipient_id: affiliateRecipientId,
      amount: val,
      type: 'flat',
      options: { liable: false, charge_remainder_fee: false, charge_processing_fee: false }
    });
    distributed += val;
  }

  // Coprodutores (Sobre pool restante)
  const poolB = pool - distributed;
  coproducers.forEach(c => {
    const val = Math.floor(poolB * (c.percentage / 100));
    if (val > 0) {
      splitArray.push({
        recipient_id: c.recipientId,
        amount: val,
        type: 'flat',
        options: { liable: false, charge_remainder_fee: false, charge_processing_fee: false }
      });
      distributed += val;
    }
  });

  // MASTER (Restante + Taxas)
  const masterVal = amountCents - distributed;
  splitArray.push({
    recipient_id: MASTER_RECIPIENT_ID,
    amount: masterVal,
    type: 'flat',
    options: { liable: true, charge_remainder_fee: true, charge_processing_fee: true }
  });

  // 3. MONTAGEM DO PAYLOAD V5 (RESET TOTAL)
  const payload: any = {
    antifraud_enabled: true,
    items: [{
      amount: amountCents,
      description: orderData.description || 'VibeCode Digital',
      quantity: 1,
      code: productId || 'item_1'
    }],
    customer: {
      name: orderData.payer.name,
      email: orderData.payer.email,
      document: orderData.payer.document.replace(/\D/g, ''),
      type: 'individual',
      phones: {
        mobile_phone: {
          country_code: '55',
          area_code: orderData.metadata?.userPhone?.substring(1, 3) || '11',
          number: orderData.metadata?.userPhone?.replace(/\D/g, '').substring(2) || '999999999'
        }
      }
    },
    payments: [{
      payment_method: paymentMethod,
      pix: paymentMethod === 'pix' ? {
        expires_in: 1800,
        split: splitArray 
      } : undefined,
      credit_card: paymentMethod === 'credit_card' ? {
        installments: orderData.installments || 1,
        statement_descriptor: 'VIBECODE',
        split: splitArray,
        card: {
          token: orderData.card_token || undefined,
          number: orderData.card_number || undefined,
          holder_name: orderData.card_holder_name || undefined,
          exp_month: orderData.card_expiration_month ? Number(orderData.card_expiration_month) : undefined,
          exp_year: orderData.card_expiration_year ? Number(orderData.card_expiration_year) : undefined,
          cvv: orderData.card_cvv || undefined,
          billing_address: orderData.billingAddress ? {
            line_1: `${orderData.billingAddress.number}, ${orderData.billingAddress.street}, ${orderData.billingAddress.neighborhood}`,
            zip_code: orderData.billingAddress.zipCode.replace(/\D/g, ''),
            city: orderData.billingAddress.city,
            state: orderData.billingAddress.state,
            country: 'BR'
          } : undefined
        }
      } : undefined,
      boleto: paymentMethod === 'boleto' ? {
        expires_in: 86400 * 3,
        instructions: 'Pagar até o vencimento.'
      } : undefined
    }],
    metadata: {
      ...orderData.metadata,
      system: 'VibeCode_V5_SplitReset'
    }
  };

  // 5. Execução da Request
  try {
    const response = await axios.post(`${PAGARME_BASE_URL}/orders`, payload, {
      headers: getHeaders()
    });

    const result = response.data;
    
    // Auditoria Firestore (KEEP)
    await dbAdmin.collection('audit_splits').add({
      status: 'success',
      orderId: result.id,
      productId: productId || 'none',
      payload_sent: JSON.parse(JSON.stringify(payload)),
      pagarme_response: result,
      timestamp: new Date().toISOString()
    });

    return result;
  } catch (error: any) {
    const errorData = error.response?.data || { message: error.message };
    console.error('[PAGARME V5 ERROR]', JSON.stringify(errorData, null, 2));
    
    // Auditoria Firestore (KEEP)
    await dbAdmin.collection('audit_splits').add({
      status: 'error',
      productId: productId || 'none',
      error: errorData,
      payload_sent: JSON.parse(JSON.stringify(payload)),
      timestamp: new Date().toISOString()
    });

    throw new Error(errorData.message || 'Erro ao processar pagamento na Pagar.me');
  }
};

/**
 * WEBHOOK HANDLER
 */
export const handlePagarmeWebhook = async (payload: any) => {
  console.log(`[PAGARME WEBHOOK] Evento: ${payload.type}`);
  
  if (payload.type === 'order.paid') {
    const orderData = payload.data;
    const email = orderData.customer?.email;
    const productId = orderData.metadata?.courseId || orderData.metadata?.productId;

    if (email && productId) {
      await provisionPurchase({
        email,
        name: orderData.customer?.name || 'Cliente',
        cpf: orderData.customer?.document || '',
        phone: orderData.metadata?.userPhone || ''
      }, String(productId), 'pagarme');

      // Registrar relatórios financeiros
      await recordAffiliateCommission(orderData);
      await recordAdminSalesReport(orderData);
      await recordCoproductionCommissions(orderData);
    }
  }

  return { success: true };
};

// Funções de Registro (KEEP + Refatoradas para Cascata V5)

async function recordAffiliateCommission(orderData: any) {
  const { dbAdmin } = getAdminConfig();
  const metadata = orderData.metadata || {};
  const affiliateId = metadata.refId;
  const productId = metadata.courseId || metadata.productId;
  
  if (!affiliateId || !productId) return;

  try {
    const productDoc = await dbAdmin.collection('ticto_products').doc(productId).get();
    if (!productDoc.exists) return;

    const pData = productDoc.data();
    const offer = (pData?.offers || []).find((o: any) => String(o.id) === String(metadata.offerId));
    const percent = offer?.isAffiliationEnabled ? (Number(offer.affiliateCommission) || 0) : 0;

    if (percent <= 0) return;

    const amount = orderData.amount;
    const fees = calculatePagarmeFees(amount, orderData.charges?.[0]?.payment_method || 'pix');
    const netCommission = Math.floor((amount - fees) * (percent / 100));

    await dbAdmin.collection('affiliate_commissions').add({
      affiliateId,
      orderId: orderData.id,
      courseId: productId,
      commissionEarned: netCommission,
      grossValue: amount,
      createdAt: new Date().toISOString()
    });

    await sendPushNotification(affiliateId, "VENDA REALIZADA! 🚀", `Comissão de R$ ${(netCommission/100).toFixed(2)} confirmada!`);
  } catch (e) {
    console.error('Erro ao gravar comissão:', e);
  }
}

async function recordAdminSalesReport(orderData: any) {
  const { dbAdmin } = getAdminConfig();
  try {
    await dbAdmin.collection('admin_sales_report').add({
      orderId: orderData.id,
      grossValue: orderData.amount,
      status: 'paid',
      customer: orderData.customer,
      metadata: orderData.metadata,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Erro ao gravar relatório admin:', e);
  }
}

async function recordCoproductionCommissions(orderData: any) {
  const { dbAdmin } = getAdminConfig();
  const metadata = orderData.metadata || {};
  const productId = metadata.courseId || metadata.productId;

  if (!productId) return;

  try {
    const productDoc = await dbAdmin.collection('ticto_products').doc(productId).get();
    if (!productDoc.exists) return;

    const pData = productDoc.data();
    const coproducers = pData?.coproduction || [];

    for (const copro of coproducers) {
      const userId = copro.userId || copro.id;
      if (userId) {
        await dbAdmin.collection('coproduction_commissions').add({
          coproducerId: userId,
          orderId: orderData.id,
          value: 0, // Cálculo simplificado para log
          createdAt: new Date().toISOString()
        });
      }
    }
  } catch (e) {
    console.error('Erro ao gravar coprodução:', e);
  }
}

// Exportando funções auxiliares necessárias
export const getPagarmeOrderStatus = async (orderId: string) => {
  const response = await axios.get(`${PAGARME_BASE_URL}/orders/${orderId}`, { headers: getHeaders() });
  return response.data;
};

export const getPagarmeRecipientBalance = async (recipientId: string) => {
  const response = await axios.get(`${PAGARME_BASE_URL}/recipients/${recipientId}/balance`, { headers: getHeaders() });
  return response.data;
};

export const requestPagarmeTransfer = async (recipientId: string, amount: number) => {
  const response = await axios.post(`${PAGARME_BASE_URL}/recipients/${recipientId}/transfers`, { amount }, { headers: getHeaders() });
  return response.data;
};
