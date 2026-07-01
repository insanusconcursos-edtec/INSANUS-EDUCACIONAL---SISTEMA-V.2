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
export const getHeaders = () => {
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
      let productData: any = null;
      const tictoDoc = await dbAdmin.collection('ticto_products').doc(productId).get();
      if (tictoDoc.exists) {
        productData = tictoDoc.data();
      } else {
        const prodDoc = await dbAdmin.collection('products').doc(productId).get();
        if (prodDoc.exists) {
          productData = prodDoc.data();
        }
      }

      if (productData) {
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
              recipientId: (c.pagarmeRecipientId || c.recipientId || '').trim(),
              percentage: Number(c.percentage) || 0,
              userId: c.userId || c.id || c.coproducerId
            })).filter(c => c.recipientId && c.percentage > 0);
          } else if (coproSource && typeof coproSource === 'object') {
            // Suporte para quando coproduction é um objeto em vez de array (raro mas possível em Firestore)
            const coproValues = Object.values(coproSource);
            coproducers = coproValues.map((c: any) => ({
              recipientId: (c.pagarmeRecipientId || c.recipientId || '').trim(),
              percentage: Number(c.percentage) || 0,
              userId: c.userId || c.id || c.coproducerId
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
      // REDUNDÂNCIA MÁXIMA V5: Injetando split e splits no root do pagamento
      split: splitArray, 
      splits: splitArray,
      pix: paymentMethod === 'pix' ? {
        expires_in: 1800,
        split: splitArray,
        splits: splitArray 
      } : undefined,
      credit_card: paymentMethod === 'credit_card' ? {
        installments: orderData.installments || 1,
        statement_descriptor: 'VIBECODE',
        split: splitArray,
        splits: splitArray,
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
      courseId: productId, // Garantir que o ID do produto esteja no metadata para o webhook
      productId: productId,
      system: 'VibeCode_V5_SplitReset'
    }
  };

  // 5. Execução da Request
  try {
    const response = await axios.post(`${PAGARME_BASE_URL}/orders`, payload, {
      headers: getHeaders()
    });

    const result = response.data;
    
    // Notificações de PIX EMITIDO
    if (paymentMethod === 'pix' && result.status === 'pending') {
      const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const title = "NOVO PIX EMITIDO! 💎";
      const body = `Venda de ${amountFormatted} aguardando pagamento.`;

      // Notificar Coprodutores
      for (const c of coproducers) {
        const identifier = c.userId || c.recipientId;
        if (identifier) {
          console.log(`[Push] Iniciando envio de PIX EMITIDO para: ${identifier}`);
          await sendPushNotification(identifier, title, body);
        }
      }

      // Notificar Afiliado
      const affiliateId = orderData.metadata?.refId;
      if (affiliateId) {
        await sendPushNotification(affiliateId, title, body);
      }

      // Notificar Admins
      try {
        const adminUsers = await dbAdmin.collection('users').where('role', '==', 'ADMIN').get();
        for (const adminDoc of adminUsers.docs) {
          await sendPushNotification(adminDoc.id, title, body);
        }
      } catch (err) {
        console.error('[Push] Erro ao notificar admins:', err);
      }
    }
    
    // 1. Salvar na coleção 'orders' para acionar o gatilho de notificação Push (PIX Emitido)
    try {
      await dbAdmin.collection('orders').doc(result.id).set({
        id: result.id,
        status: result.status,
        payment_method: paymentMethod,
        transaction_amount: amountCents,
        description: orderData.description || 'VibeCode Digital',
        split: splitArray,
        customer: payload.customer,
        metadata: payload.metadata,
        createdAt: new Date().toISOString()
      });
      console.log(`[Push Trigger] Ordem ${result.id} salva na coleção 'orders' (Status: ${result.status})`);
    } catch (dbErr) {
      console.error('[Push Trigger] Erro ao salvar na coleção orders:', dbErr);
    }
    
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
    const { dbAdmin } = getAdminConfig();

    // Atualizar status na coleção 'orders' para acionar o gatilho de notificação Push (Sucesso)
    try {
      const orderRef = dbAdmin.collection('orders').doc(orderData.id);
      await orderRef.update({
        status: 'paid',
        updatedAt: new Date().toISOString()
      });
      console.log(`[PAGARME WEBHOOK] Status da ordem ${orderData.id} atualizado para pago.`);
    } catch (err) {
      console.error('[Push Trigger] Erro ao atualizar status da ordem:', err);
    }

    const email = orderData.customer?.email;
    const productId = orderData.metadata?.courseId || 
                     orderData.metadata?.productId || 
                     orderData.items?.[0]?.code;

    if (email && productId && productId !== 'item_1') {
      // 1. Provisionamento para o comprador principal
      await provisionPurchase({
        email,
        name: orderData.customer?.name || 'Cliente',
        cpf: orderData.customer?.document || '',
        phone: orderData.metadata?.userPhone || ''
      }, String(productId), 'pagarme');

      // 2. Provisionamento para os amigos (se houver)
      const friendsJson = orderData.metadata?.friends;
      if (friendsJson) {
        try {
          const friends = JSON.parse(friendsJson);
          if (Array.isArray(friends)) {
            for (const friend of friends) {
              if (friend.email) {
                console.log(`[PAGARME WEBHOOK] Provisionando amigo: ${friend.email}`);
                await provisionPurchase({
                  email: friend.email,
                  name: friend.name || 'Convidado',
                  cpf: friend.cpf || '',
                  phone: friend.phone || ''
                }, String(productId), 'pagarme');
              }
            }
          }
        } catch (err) {
          console.error('[PAGARME WEBHOOK] Erro ao processar lista de amigos:', err);
        }
      }

      // Registrar relatórios financeiros
      console.log(`[PAGARME WEBHOOK] Iniciando registros financeiros para Ordem: ${orderData.id}`);
      await recordAffiliateCommission(orderData);
      await recordAdminSalesReport(orderData);
      await recordCoproductionCommissions(orderData);
      console.log(`[PAGARME WEBHOOK] Registros finalizados com sucesso.`);
    }
  }

  return { success: true };
};

// Funções de Registro (KEEP + Refatoradas para Cascata V5)

async function recordAffiliateCommission(orderData: any) {
  const { dbAdmin } = getAdminConfig();
  const metadata = orderData.metadata || {};
  const affiliateId = metadata.refId;
  const productId = metadata.courseId || metadata.productId || orderData.items?.[0]?.code;
  
  if (!affiliateId || !productId || productId === 'item_1') return;

  try {
    // Busca o produto em ambas as coleções
    let pData: any = null;
    const tictoDoc = await dbAdmin.collection('ticto_products').doc(productId).get();
    if (tictoDoc.exists) {
      pData = tictoDoc.data();
    } else {
      const prodDoc = await dbAdmin.collection('products').doc(productId).get();
      if (prodDoc.exists) {
        pData = prodDoc.data();
      }
    }

    if (!pData) return;

    const offer = (pData?.offers || []).find((o: any) => String(o.id) === String(metadata.offerId));
    const percent = offer?.isAffiliationEnabled ? (Number(offer.affiliateCommission) || 0) : 0;

    if (percent <= 0) return;

    const amount = orderData.amount;
    const paymentMethod = orderData.charges?.[0]?.payment_method || orderData.payment_method || 'pix';
    const installments = orderData.charges?.[0]?.last_transaction?.installments || 1;
    const fees = calculatePagarmeFees(amount, paymentMethod, installments);
    const netCommission = Math.floor((amount - fees) * (percent / 100));

    // Captura dados do cliente para o relatório
    const customer = orderData.customer || {};
    let phone = metadata.userPhone || customer.phones?.mobile_phone?.number || 'N/A';
    if (customer.phones?.mobile_phone) {
      const mp = customer.phones.mobile_phone;
      phone = `+${mp.country_code}${mp.area_code}${mp.number}`;
    }

    // Verificar duplicidade antes de registrar (Idempotência)
    const checkExisting = await dbAdmin.collection('affiliate_commissions')
      .where('orderId', '==', orderData.id)
      .where('affiliateId', '==', affiliateId)
      .limit(1)
      .get();

    if (!checkExisting.empty) {
      console.log(`[AFFILIATE LOG] Comissão da ordem ${orderData.id} para o afiliado ${affiliateId} já foi gravada. Ignorando duplicidade.`);
      return;
    }

    await dbAdmin.collection('affiliate_commissions').add({
      affiliateId,
      orderId: orderData.id,
      orderCode: orderData.code || 'N/A',
      courseId: productId,
      courseName: pData.name || 'Produto',
      commissionEarned: netCommission,
      grossValue: amount,
      paymentMethod: paymentMethod,
      customerName: customer.name || 'Cliente',
      customerEmail: customer.email || 'N/A',
      customerPhone: phone,
      createdAt: new Date().toISOString()
    });

    await sendPushNotification(affiliateId, "VENDA CONFIRMADA! 🚀", `Comissão de R$ ${(netCommission/100).toFixed(2)} confirmada!`);
  } catch (e) {
    console.error('Erro ao gravar comissão:', e);
  }
}

async function recordAdminSalesReport(orderData: any) {
  const { dbAdmin } = getAdminConfig();
  const metadata = orderData.metadata || {};
  const productId = metadata.courseId || metadata.productId || orderData.items?.[0]?.code;
  const offerId = metadata.offerId;

  if (!productId || productId === 'item_1') {
    console.error('[Admin Report] Sem productId no metadata ou items');
    return;
  }

  try {
    // Busca o produto em ambas as coleções
    let pData: any = null;
    const tictoDoc = await dbAdmin.collection('ticto_products').doc(productId).get();
    if (tictoDoc.exists) {
      pData = tictoDoc.data();
    } else {
      const prodDoc = await dbAdmin.collection('products').doc(productId).get();
      if (prodDoc.exists) {
        pData = prodDoc.data();
      }
    }

    if (!pData) return;

    const offersArray = pData?.offers || [];
    const currentOffer = offersArray.find((o: any) => String(o.id) === String(offerId));
    
    const amountCents = orderData.amount;
    const paymentMethod = orderData.charges?.[0]?.payment_method || 'pix';
    const installments = orderData.charges?.[0]?.last_transaction?.installments || 1;
    
    // Gateway Fee
    const gatewayFee = calculatePagarmeFees(amountCents, paymentMethod, installments);
    const pool = amountCents - gatewayFee;

    // Afiliado
    let affiliatePercent = 0;
    if (currentOffer && currentOffer.isAffiliationEnabled) {
      affiliatePercent = Number(currentOffer.affiliateCommission) || 0;
    }
    let affiliatePart = Math.floor(pool * (affiliatePercent / 100));
    
    // Coprodução (Prioridade para splits reais se disponíveis)
    let coproductionPart = 0;
    const charges = orderData.charges || [];
    // Tenta encontrar splits reais na carga útil do webhook
    const actualSplits = charges[0]?.last_transaction?.splits || 
                         charges[0]?.last_transaction?.split ||
                         charges[0]?.last_transaction?.split_rules ||
                         charges[0]?.splits || 
                         charges[0]?.split ||
                         charges[0]?.split_rules ||
                         orderData.splits || 
                         orderData.split || 
                         orderData.split_rules ||
                         [];

    if (actualSplits.length > 0) {
      // Descobre o master real para não subtrair do próprio master
      const envMasterId = process.env.PAGARME_MASTER_RECIPIENT_ID || MASTER_RECIPIENT_ID;
      const hasRealMaster = actualSplits.find((s: any) => (s.recipient_id || s.recipient?.id || s.id) === envMasterId);
      const appliedMasterId = hasRealMaster ? envMasterId : [...actualSplits].sort((a,b) => b.amount - a.amount)[0]?.recipient_id || [...actualSplits].sort((a,b) => b.amount - a.amount)[0]?.recipient?.id || [...actualSplits].sort((a,b) => b.amount - a.amount)[0]?.id;

      actualSplits.forEach((s: any) => {
        const sRecipientId = s.recipient_id || s.recipient?.id || s.id;
        if (sRecipientId !== appliedMasterId) {
          coproductionPart += s.amount;
        }
      });
      
      // Ajuste: Evitamos colocar a comissão do afiliado 2 vezes na variável Taxas/Comissões
      if (affiliatePart > 0 && coproductionPart >= affiliatePart) {
        coproductionPart -= affiliatePart;
      } else if (affiliatePart > 0 && coproductionPart < affiliatePart) {
        affiliatePart = coproductionPart;
        coproductionPart = 0;
      }
    } else {
      // Fallback manual (Comissões em cascata sobre a base líquida)
      const coproducers = currentOffer?.coproducers || pData?.coproduction || pData?.coproducers || [];
      const totalCoproPercentage = coproducers.reduce((acc: number, copro: any) => acc + (Number(copro.percentage) || 0), 0);
      
      if (totalCoproPercentage > 0) {
        const remainderForCopro = pool - affiliatePart;
        coproductionPart = Math.floor(remainderForCopro * (totalCoproPercentage / 100));
      } else {
        coproductionPart = 0;
      }
    }

    const totalTaxasEComissoes = gatewayFee + coproductionPart + affiliatePart;
    const netCompanyValue = amountCents - totalTaxasEComissoes;

    // Verificar duplicidade antes de registrar (Idempotência)
    const checkExisting = await dbAdmin.collection('admin_sales_report')
      .where('orderId', '==', orderData.id)
      .limit(1)
      .get();

    if (!checkExisting.empty) {
      console.log(`[ADMIN REPORT LOG] Relatório de vendas para ordem ${orderData.id} já foi registrado. Ignorando duplicidade.`);
      return;
    }

    await dbAdmin.collection('admin_sales_report').add({
      orderId: orderData.id,
      courseId: productId,
      courseName: pData.name || 'Produto',
      grossValue: amountCents,
      gatewayFee,
      affiliatePart,
      coproductionPart,
      netCompanyValue,
      status: 'paid',
      customer: orderData.customer,
      metadata: orderData.metadata,
      createdAt: new Date().toISOString()
    });

    const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const productDesc = pData.name || orderData.description || 'Venda';
    
    const adminUsers = await dbAdmin.collection('users').where('role', '==', 'ADMIN').get();
    for (const adminDoc of adminUsers.docs) {
      await sendPushNotification(adminDoc.id, "VENDA CONFIRMADA! 🔥", `${productDesc} - ${amountFormatted}`);
    }
  } catch (e) {
    console.error('Erro ao gravar relatório admin:', e);
  }
}

async function recordCoproductionCommissions(orderData: any) {
  const { dbAdmin } = getAdminConfig();
  const metadata = orderData.metadata || {};
  const productId = metadata.courseId || metadata.productId || orderData.items?.[0]?.code;
  const offerId = metadata.offerId;

  if (!productId || productId === 'item_1') return;

  try {
    // Busca o produto em ambas as coleções possíveis
    let pData: any = null;
    const tictoDoc = await dbAdmin.collection('ticto_products').doc(productId).get();
    if (tictoDoc.exists) {
      pData = tictoDoc.data();
    } else {
      const prodDoc = await dbAdmin.collection('products').doc(productId).get();
      if (prodDoc.exists) {
        pData = prodDoc.data();
      }
    }

    if (!pData) {
      console.warn(`[SPLIT] Produto ${productId} não encontrado em nenhuma coleção.`);
      return;
    }

    const amountCents = Number(orderData.amount) || 0;
    
    // PRIORIDADE: Pegar os splits reais que o Pagar.me executou
    const charges = orderData.charges || [];
    // Tenta encontrar splits em várias profundidades comuns da API V5/V4 e retornos de webhooks
    const actualSplits = charges[0]?.last_transaction?.splits || 
                         charges[0]?.last_transaction?.split ||
                         charges[0]?.last_transaction?.split_rules ||
                         charges[0]?.splits || 
                         charges[0]?.split ||
                         charges[0]?.split_rules ||
                         orderData.splits || 
                         orderData.split || 
                         orderData.split_rules ||
                         [];

    if (actualSplits.length > 0) {
      console.log(`[SPLIT] Usando ${actualSplits.length} splits reais da Pagar.me para registro.`);
      
      const envMasterId = process.env.PAGARME_MASTER_RECIPIENT_ID || MASTER_RECIPIENT_ID;

      for (const split of actualSplits) {
        const recipientId = split.recipient_id || split.recipient?.id || split.id;
        const commissionValue = split.amount;

        if (!recipientId) continue;

        // Ignorar o Master Recipient no relatório de coprodução individual
        if (recipientId === envMasterId) continue;

        // Tenta encontrar o UID pelo RecipientId para vínculo correto
        let identifier = recipientId;
        try {
          const userLookup = await dbAdmin.collection('users')
            .where('pagarmeRecipientId', '==', recipientId)
            .limit(1)
            .get();
          
          if (!userLookup.empty) {
            identifier = userLookup.docs[0].id;
          }
        } catch (lookErr) {
          console.error('[SPLIT] Erro ao buscar UID:', lookErr);
        }

        if (commissionValue > 0) {
          // Verificar duplicidade antes de registrar (Idempotência)
          const checkExisting = await dbAdmin.collection('coproduction_commissions')
            .where('orderId', '==', orderData.id)
            .where('coproducerId', '==', identifier)
            .limit(1)
            .get();

          if (!checkExisting.empty) {
            console.log(`[SPLIT LOG] Comissão da ordem ${orderData.id} para o coprodutor ${identifier} já existe. Pulando para obter idempotência.`);
            continue;
          }

          // Captura dados do cliente para o relatório
          const customer = orderData.customer || {};
          let phone = metadata.userPhone || customer.phones?.mobile_phone?.number || 'N/A';
          if (customer.phones?.mobile_phone) {
            const mp = customer.phones.mobile_phone;
            phone = `+${mp.country_code}${mp.area_code}${mp.number}`;
          }

          await dbAdmin.collection('coproduction_commissions').add({
            coproducerId: identifier,
            recipientId: recipientId,
            orderId: orderData.id,
            orderCode: orderData.code || 'N/A',
            courseId: productId,
            courseName: pData.name || 'Produto',
            commissionValue: commissionValue, 
            grossValue: amountCents,
            paymentMethod: orderData.charges?.[0]?.payment_method || orderData.payment_method || 'pix',
            customerName: customer.name || 'Cliente',
            customerEmail: customer.email || 'N/A',
            customerPhone: phone,
            createdAt: new Date().toISOString(),
            status: 'paid'
          });
          
          const amountFormatted = (commissionValue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          await sendPushNotification(identifier, "VENDA CONFIRMADA! 🚀", `Sua comissão de ${amountFormatted} foi registrada.`);
          console.log(`[SPLIT LOG] Comissão real gravada para ${identifier}: R$ ${commissionValue/100}`);
        }
      }
      return; // Sucesso com splits reais
    }

    // FALLBACK: Cálculo manual (se não vierem splits no payload)
    console.log(`[SPLIT] Payload sem splits. Usando fallback de cálculo manual.`);
    const offersArray = pData?.offers || [];
    const currentOffer = offersArray.find((o: any) => String(o.id) === String(offerId));
    const coproSource = currentOffer?.coproducers || pData?.coproduction || pData?.coproducers || [];
    
    const paymentMethod = orderData.charges?.[0]?.payment_method || 'pix';
    const installments = orderData.charges?.[0]?.last_transaction?.installments || 1;
    const fees = calculatePagarmeFees(amountCents, paymentMethod, installments);
    const pool = Math.max(0, amountCents - fees);

    let affiliatePercent = 0;
    if (currentOffer && currentOffer.isAffiliationEnabled) {
      affiliatePercent = Number(currentOffer.affiliateCommission) || 0;
    }
    const distributedAffiliate = Math.floor(pool * (affiliatePercent / 100));
    const poolForCopro = Math.max(0, pool - distributedAffiliate);

    for (const copro of coproSource) {
      const recipientId = (copro.pagarmeRecipientId || copro.recipientId || '').trim();
      let userId = copro.userId || copro.id || copro.coproducerId;
      const percentage = Number(copro.percentage) || 0;

      if (!userId && recipientId) {
        const userLookup = await dbAdmin.collection('users').where('pagarmeRecipientId', '==', recipientId).limit(1).get();
        if (!userLookup.empty) userId = userLookup.docs[0].id;
      }
      
      const identifier = userId || recipientId;
      
      if (identifier && percentage > 0) {
        const commissionValue = Math.floor(poolForCopro * (percentage / 100));
        
        // Verificar duplicidade antes de registrar (Idempotência)
        const checkExisting = await dbAdmin.collection('coproduction_commissions')
          .where('orderId', '==', orderData.id)
          .where('coproducerId', '==', identifier)
          .limit(1)
          .get();

        if (!checkExisting.empty) {
          console.log(`[SPLIT LOG] [FALLBACK] Comissão da ordem ${orderData.id} para o coprodutor ${identifier} já existe. Pulando para obter idempotência.`);
          continue;
        }

        // Captura dados do cliente para o relatório fallback
        const customer = orderData.customer || {};
        let phone = metadata.userPhone || customer.phones?.mobile_phone?.number || 'N/A';
        if (customer.phones?.mobile_phone) {
          const mp = customer.phones.mobile_phone;
          phone = `+${mp.country_code}${mp.area_code}${mp.number}`;
        }

        await dbAdmin.collection('coproduction_commissions').add({
          coproducerId: identifier,
          orderId: orderData.id,
          orderCode: orderData.code || 'N/A',
          courseId: productId,
          courseName: pData.name || 'Produto',
          commissionValue: commissionValue, 
          grossValue: amountCents,
          paymentMethod: paymentMethod,
          customerName: customer.name || 'Cliente',
          customerEmail: customer.email || 'N/A',
          customerPhone: phone,
          createdAt: new Date().toISOString(),
          status: 'paid'
        });
        
        const amountFormatted = (commissionValue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        await sendPushNotification(identifier, "VENDA CONFIRMADA! 🚀", `Sua comissão de ${amountFormatted} foi registrada.`);
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
  try {
    const url = `${PAGARME_BASE_URL}/recipients/${recipientId}/balance`;
    const response = await axios.get(url, { headers: getHeaders() });
    const data = response.data;
    
    return {
      available: data.available_amount || 0,
      waiting_funds: data.waiting_funds_amount || 0,
      transferred: data.transferred_amount || 0,
      recipient_name: data.recipient?.name || ''
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.warn(`[PAGARME] Saldo não encontrado para recebedor ${recipientId} (404)`);
    } else {
      console.error(`[PAGARME] Erro ao buscar saldo de ${recipientId}:`, error.message);
    }
    throw error;
  }
};

export const getPagarmeRecipients = async () => {
  const response = await axios.get(`${PAGARME_BASE_URL}/recipients`, { headers: getHeaders() });
  return response.data;
};

export const requestPagarmeTransfer = async (recipientId: string, amount: number) => {
  const response = await axios.post(`${PAGARME_BASE_URL}/recipients/${recipientId}/transfers`, { amount }, { headers: getHeaders() });
  return response.data;
};
