
import { provisionPurchase } from './provisioningService.js';
import { getAdminConfig } from './firebaseAdmin.js';
import { sendPushNotification } from './notificationAdminService.js';

const PAGARME_BASE_URL = 'https://api.pagar.me/core/v5';
const PAGARME_API_URL = `${PAGARME_BASE_URL}/orders`;

// Configuração limpa do Axios para Pagar.me
const getPagarmeClient = async () => {
  const axios = (await import('axios')).default;
  return axios.create({
    baseURL: PAGARME_BASE_URL,
    headers: getHeaders(),
    timeout: 30000 // 30 segundos
  });
};

// Pagar.me Fees (in cents) - PIX 2%, Card 2.45% (requested by user)
const calculatePagarmeFees = (amountCents: number, method: string, installments: number = 1): number => {
  console.log(`[INTEGRIDADE] Calculando taxas para ${method} (${installments}x) sobre ${amountCents} centavos`);
  let fee = 0;
  if (method === 'pix') {
    fee = Math.round(amountCents * 0.02); // 2%
  } else if (method === 'ticket') {
    fee = 319; // R$ 3,19 fixo
  } else if (method === 'credit_card') {
    let rate = 0.0245; // 2.45% (Master requested specifically 2.45%)
    // Mantendo progressão caso necessário, mas base é 2.45%
    if (installments >= 2 && installments <= 6) {
      rate = 0.03; // 3% (2-6x)
    } else if (installments >= 7) {
      rate = 0.035; // 3.5% (7-12x)
    }
    fee = Math.round(amountCents * rate) + 80; // taxa + R$ 0,80 (proc + antifraude)
  }
  console.log(`[INTEGRIDADE] Taxa calculada: ${fee} centavos`);
  return fee;
};

// Helper para buscar ID Master do Firestore
const getMasterRecipientId = async (): Promise<string> => {
  try {
    const { dbAdmin } = getAdminConfig();
    // Adicionamos um timeout manual para não travar o boot ou o checkout se o Firestore estiver lento
    const getWithTimeout = async () => {
      const docPromise = dbAdmin.collection('settings').doc('payment').get();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore timeout')), 3000)
      );
      return Promise.race([docPromise, timeoutPromise]) as Promise<any>;
    };

    const settingsDoc = await getWithTimeout();
    if (settingsDoc && settingsDoc.exists && settingsDoc.data()?.pagarmeMasterId) {
      const id = settingsDoc.data()?.pagarmeMasterId;
      console.log(`[Pagarme] ✅ ID Master recuperado do Firestore: ${id}`);
      return id;
    }
  } catch (err) {
    console.warn('[Pagarme] ⚠️ Aviso: Falha ao buscar ID Master no Firestore (usando fallback):', err instanceof Error ? err.message : String(err));
  }
  
  const envId = process.env.PAGARME_MASTER_RECIPIENT_ID || process.env.PAGARME_RECIPIENT_ID || 're_cmouicmz204gz0l9tyr4jkmut';
  console.log(`[Pagarme] ⚠️ Usando ID Master do env/fallback: ${envId}`);
  return envId;
};

const INSTALLMENT_MULTIPLIERS: Record<number, number> = {
  1: 1.00000, 2: 1.04018, 3: 1.06027, 4: 1.08036,
  5: 1.10045, 6: 1.12054, 7: 1.14063, 8: 1.16072,
  9: 1.18081, 10: 1.20090, 11: 1.22100, 12: 1.24109
};

const getHeaders = () => {
  const secretKey = (process.env.PAGARME_SECRET_KEY || '').trim();
  if (!secretKey) throw new Error('PAGARME_SECRET_KEY not found in environment');
  
  const auth = Buffer.from(`${secretKey}:`).toString('base64');
  return {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

export const createPagarmeOrder = async (orderData: any, initialCoproducers: any[] = []) => {
  process.stderr.write(">>>> [AUDITORIA] INICIANDO PROCESSO DE SPLIT <<<<\n");
  console.log('[INTEGRIDADE] Sistema operando em modo estável');
  console.log('[Pagarme] 🛒 Iniciando criação de pedido para:', orderData.description);
  const { dbAdmin } = getAdminConfig();

  // 0. Fetch Product/Offer data from Firestore to get Split Rules
  let coproducers = [...initialCoproducers];
  let affiliateDataFromDB = null;
  let affiliateCommissionPercent = 0;

  try {
    const productId = orderData.metadata?.courseId || orderData.metadata?.productId || orderData.productId;
    const metadata = orderData.metadata || {};
    const offerId = metadata.offerId;
    
    if (productId) {
      if (orderData.payment_method === 'pix') {
        process.stdout.write(`>>>> [CRITICAL-LOG] INICIANDO PIX - TIMESTAMP: ${new Date().toISOString()} <<<<\n`);
      }
      const startLog = `[AUDITORIA-INICIO] Processando ${orderData.payment_method || 'PEDIDO'} para Produto ID: ${productId}\n`;
      process.stdout.write(startLog);
      const productDoc = await dbAdmin.collection('ticto_products').doc(productId).get();
      
      if (productDoc.exists) {
        const courseData = productDoc.data();
        console.log(`[Pagarme] 📦 Dados Brutos do Produto Recuperados:`, JSON.stringify(courseData));
        
        // 1. Encontra a oferta exata dentro do array do produto (se existir)
        const offersArray = courseData?.offers || [];
        const currentOffer = offersArray.find((offer: any) => String(offer.id) === String(offerId));

        // 2. Aplicação de Descontos Dinâmicos (PIX/Boleto) antes de prosseguir
        let basePrice = currentOffer?.price || courseData?.price || Number(orderData.transaction_amount);
        const method = orderData.payment_method;
        
        if (method === 'pix' && currentOffer?.pixDiscount > 0) {
           const discount = Number(currentOffer.pixDiscount);
           basePrice = basePrice * (1 - (discount / 100));
           console.log(`[Pagarme] 🎯 Desconto PIX: ${discount}% | Base: ${currentOffer.price} -> ${basePrice}`);
        } else if (method === 'ticket' && currentOffer?.boletoDiscount > 0) {
           const discount = Number(currentOffer.boletoDiscount);
           basePrice = basePrice * (1 - (discount / 100));
           console.log(`[Pagarme] 🎯 Desconto Boleto: ${discount}% | Base: ${currentOffer.price} -> ${basePrice}`);
        }

        // Atualiza o transaction_amount do pedido para refletir o desconto
        orderData.transaction_amount = basePrice;

        // 3. Extrai a comissão exata e verifica se a afiliação está ativa
        const percentualVendedor = currentOffer && currentOffer.isAffiliationEnabled ? (Number(currentOffer.affiliateCommission) || 0) : 0;
        affiliateCommissionPercent = percentualVendedor;

        console.log(`✅ [DEBUG AFILIADO] Oferta ID: ${offerId} | Comissão Extraída: ${percentualVendedor}%`);

        // Extrair coprodutores do documento (Sincronização com CoproductionDashboard e ProductFormModal field names)
        const coproSource = courseData?.coproduction || courseData?.coproducers || courseData?.splits || [];
        
        if (Array.isArray(coproSource) && coproSource.length > 0) {
          coproducers = coproSource.map((item: any) => ({
            recipientId: item.pagarmeRecipientId || item.recipientId || item.pagarme_recipient_id || item.id,
            percentage: Number(item.percentage) || Number(item.comission) || 0
          })).filter(c => c.recipientId && c.percentage > 0);
          console.log(`[Pagarme] ✅ ${coproducers.length} Coprodutores mapeados do Produto (Documento Principal). IDs: ${coproducers.map(c => c.recipientId).join(', ')}`);
        } else if (currentOffer?.coproducers && Array.isArray(currentOffer.coproducers)) {
          coproducers = currentOffer.coproducers;
          console.log(`[Pagarme] ✅ ${coproducers.length} Coprodutores encontrados na Oferta.`);
        }
      } else {
        console.error(`❌ [ERRO CRÍTICO] O ID ${productId} não existe na coleção ticto_products! Verifique se o ID passado (${productId}) é o Document ID correto.`);
      }
    }
        
    // 3. Buscar dados do Vendedor (Afiliado) se houver ID (refId priorizado)
    const affiliateId = orderData.metadata?.refId || orderData.metadata?.affiliateId || orderData.affiliateId;
    if (affiliateId) {
      const affDoc = await dbAdmin.collection('users').doc(affiliateId).get();
      if (affDoc.exists) {
        const affUser = affDoc.data();
        if (affUser?.pagarmeRecipientId) {
          affiliateDataFromDB = {
            percentage: affiliateCommissionPercent || Number(orderData.metadata?.affiliatePercentage) || Number(orderData.affiliatePercentage) || 0,
            recipientId: affUser.pagarmeRecipientId
          };
          console.log(`[Pagarme] ✅ Vendedor (Afiliado) identificado: ${affUser.name} (${affiliateId}) - ${affiliateDataFromDB.percentage}%`);
        } else {
          console.warn(`⚠️ [Pagarme] Vendedor ${affiliateId} não possui pagarmeRecipientId configurado.`);
        }
      }
    }
    
    const rulesLog = `>>>> [AUDITORIA] Regras do Firestore: ${JSON.stringify({ affiliateDataFromDB, coproducers })}\n`;
    process.stderr.write(rulesLog);
  } catch (error) {
    process.stdout.write(`[AUDITORIA-ERRO-FIREBASE] Erro ao buscar dados de split: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // Recalculate total amount with interest based on installments
  const installments = orderData.installments || 1;
  const multiplier = INSTALLMENT_MULTIPLIERS[installments] || 1;
  const originalAmount = Number(orderData.transaction_amount);
  const totalAmountWithInterest = originalAmount * multiplier;

  // Pagar.me works with cents
  const totalAmountCents = Math.round(totalAmountWithInterest * 100);

  // 🔴 LÓGICA DE DISTRIBUIÇÃO EM CASCATA (Split Cascade - Refatorado 14/05/2026):

  console.log(`>>>> [AUDITORIA-DEBUG] Iniciando cálculo de Split para ${orderData.description} <<<<`);
  console.log(`>>>> [AUDITORIA-DEBUG] Coprodutores na memória: ${JSON.stringify(coproducers)} <<<<`);

  // 1. Valor Bruto da Transação
  const grossAmount = totalAmountCents;
  const rawMethod = orderData.payment_method;
  const paymentMethod = (rawMethod === 'ticket' || rawMethod === 'boleto' || rawMethod === 'ticket') ? 'boleto' : rawMethod;
  
  // 2. Cálculo das Taxas Pagar.me (Dedução 1)
  const pagarmeFees = calculatePagarmeFees(grossAmount, paymentMethod, installments);

  // 3. Saldo A: Bruto - Taxas (Base para comissões - RATEIO AUTOMÁTICO)
  const saldoA = grossAmount - pagarmeFees;
  console.log(`[Pagarme Cascade] Bruto: ${grossAmount} | Taxas Pagar.me: ${pagarmeFees} | Saldo A (Líquido Base): ${saldoA}`);

  const masterRecipientId = await getMasterRecipientId();
  const splitArray: any[] = [];
  let totalNetDistributed = 0;

  // Helper para criar item de split com a estrutura exata exigida pela V5
  const createSplitItem = (recipientId: string, amount: number, label: string = 'Splits') => {
    const roundedAmount = Math.round(amount);
    console.log(`[SPLIT-ITEM] Adicionando item (${label}): ID=${recipientId} | Valor=${roundedAmount}`);
    
    // STRICT V5: Apenas o recebedor Master paga a taxa de processamento
    const isMaster = recipientId.trim() === masterRecipientId.trim();
    
    return {
      amount: roundedAmount,
      recipient_id: recipientId.trim(),
      type: 'flat',
      options: { 
        liable: isMaster, 
        charge_processing_fee: isMaster,
        charge_remainder_fee: isMaster
      }
    };
  };

  // 4. Saldo A -> Dedução Vendedor/Afiliado (Comissão sobre Saldo Líquido A)
  let affiliateAmount = 0;
  if (affiliateDataFromDB && affiliateDataFromDB.recipientId && affiliateDataFromDB.percentage > 0) {
    affiliateAmount = Math.floor(saldoA * (affiliateDataFromDB.percentage / 100));
    if (affiliateAmount > 0) {
      console.log(`[SPLIT] Processando regras para o recebedor ${affiliateDataFromDB.recipientId} (Afiliado) no valor líquido de ${affiliateAmount}`);
      splitArray.push(createSplitItem(affiliateDataFromDB.recipientId, affiliateAmount, 'Afiliado'));
      totalNetDistributed += affiliateAmount;
      console.log(`✅ [Pagarme Split] Vendedor ${affiliateDataFromDB.recipientId} recebe ${affiliateAmount} (${affiliateDataFromDB.percentage}% do Saldo A)`);
    }
  }

  // 5. Saldo B: Saldo A - Comissão Vendedor (Base para Coprodutores)
  const saldoB = saldoA - affiliateAmount;
  console.log(`[Pagarme Cascade] Saldo B (Base Coprodução Líquida): ${saldoB}`);

  // 6. Saldo B -> Loop de Coprodutores (Comissão sobre Saldo Líquido B)
  const coprodutoresArray = coproducers || [];
  if (coprodutoresArray.length > 0) {
    coprodutoresArray.forEach((copro: any, idx) => {
      // Suporte a múltiplas nomenclaturas de ID do recebedor
      const recipientId = copro.pagarmeRecipientId || copro.recipientId || copro.pagarme_recipient_id;
      const percentage = Number(copro.percentage) || 0;
      
      console.log(`[SPLIT-LOOP] Analisando coprodutor ${idx}: ID=${recipientId} | %=${percentage}`);

      if (recipientId && recipientId.trim().startsWith('re_') && percentage > 0) {
        const coproAmount = Math.floor(saldoB * (percentage / 100));
        if (coproAmount > 0) {
          console.log(`[SPLIT] Processando regras para o recebedor ${recipientId} no valor líquido de ${coproAmount}`);
          splitArray.push(createSplitItem(recipientId, coproAmount, `Coprodutor-${idx}`));
          totalNetDistributed += coproAmount;
          console.log(`✅ [Pagarme Split] Coprodutor ${recipientId} recebe ${coproAmount} (${percentage}% do Saldo B)`);
        }
      } else {
        console.warn(`❌ [Pagarme Split] Coprodutor ${idx} ignorado. Motivo: ${!recipientId ? 'Sem ID' : !recipientId.trim().startsWith('re_') ? 'ID não inicia com re_' : 'Porcentagem zero'}`);
      }
    });
  }

  // 7. Conta Master Recipient (Recebe o RESTO para totalizar o grossAmount)
  // IMPORTANTE: Para o split V5 ser válido, a soma dos itens deve ser o total bruto
  const masterAmount = grossAmount - totalNetDistributed;

  if (masterRecipientId) {
    splitArray.push(createSplitItem(masterRecipientId, masterAmount, 'Master'));
    
    // Verificação de integridade da soma
    const finalSum = splitArray.reduce((acc, curr) => acc + curr.amount, 0);
    console.log(`>>>> [AUDITORIA-FINAL] Soma do Split: ${finalSum} | Bruto Esperado: ${grossAmount} | Diferença: ${grossAmount - finalSum} <<<<`);
    
    if (finalSum !== grossAmount) {
      console.warn("⚠️ [AJUSTE] Ajustando discrepância de centavos no Master...");
      const diff = grossAmount - finalSum;
      splitArray[splitArray.length - 1].amount += diff;
    }
  } else {
    console.error("❌ [ERRO CRÍTICO] Master Recipient ID não encontrado!");
  }

  console.log("🚨 [Pagarme Cascade] Distribuição Final Finalizada:", JSON.stringify(splitArray));

  // 3. Build Payload (Update: STRICT V5 Positioning)
  const payload: any = {
    antifraud_enabled: true,
    items: [
      {
        amount: totalAmountCents,
        description: orderData.description || 'Produto Digital',
        quantity: 1,
        code: orderData.productId || 'item_1'
      }
    ],
    customer: {
      name: orderData.payer.name,
      email: orderData.payer.email,
      type: 'individual',
      document: orderData.payer.document.replace(/\D/g, ''),
      phones: {
        mobile_phone: {
          country_code: '55',
          area_code: orderData.metadata.userPhone?.substring(1, 3) || '11',
          number: orderData.metadata.userPhone?.replace(/\D/g, '').substring(2) || '999999999'
        }
      }
    },
    payments: [
      {
        payment_method: paymentMethod,
        // Configuração de Cartão de Crédito
        credit_card: paymentMethod === 'credit_card' ? {
            installments: orderData.installments || 1,
            statement_descriptor: 'VIBECODE',
            splits: splitArray.length > 0 ? splitArray : undefined,
            card: orderData.card_token ? {
              token: orderData.card_token,
              billing_address: orderData.billingAddress ? {
                line_1: `${orderData.billingAddress.number}, ${orderData.billingAddress.street}, ${orderData.billingAddress.neighborhood}`,
                zip_code: orderData.billingAddress.zipCode.replace(/\D/g, ''),
                city: orderData.billingAddress.city,
                state: orderData.billingAddress.state,
                country: "BR"
              } : undefined
            } : {
              number: orderData.card_number,
              holder_name: orderData.card_holder_name,
              exp_month: Number(orderData.card_expiration_month),
              exp_year: Number(orderData.card_expiration_year),
              cvv: orderData.card_cvv,
              billing_address: orderData.billingAddress ? {
                line_1: `${orderData.billingAddress.number}, ${orderData.billingAddress.street}, ${orderData.billingAddress.neighborhood}`,
                zip_code: orderData.billingAddress.zipCode.replace(/\D/g, ''),
                city: orderData.billingAddress.city,
                state: orderData.billingAddress.state,
                country: "BR"
              } : undefined
            }
        } : undefined,
        // Configuração de PIX (STRICT V5 plural 'splits')
        pix: paymentMethod === 'pix' ? {
            expires_in: 1800, // 30 minutes
            splits: splitArray.length > 0 ? splitArray : undefined
        } : undefined,
        // Configuração de Boleto (Ticker)
        boleto: paymentMethod === 'boleto' ? {
            expires_in: 86400 * 3, // 3 days
            splits: splitArray.length > 0 ? splitArray : undefined
        } : undefined,
      }
    ],
    metadata: orderData.metadata
  };

  // Preparar dados de auditoria
  const productIdLog = orderData.metadata?.courseId || orderData.metadata?.productId || orderData.productId || 'none';
  const auditData: any = {
    productId: productIdLog,
    orderDescription: orderData.description || 'N/A',
    splitSent: JSON.parse(JSON.stringify(splitArray)),
    paymentMethod: paymentMethod,
    timestamp: new Date().toISOString(),
    amountCents: totalAmountCents,
    calculations: {
      totalAmountCents,
      pagarmeFees,
      totalNetDistributed,
      remainderMaster: masterAmount
    }
  };

  // Critical Log for Auditing as requested
  const safePayload = JSON.parse(JSON.stringify(payload));
  if (safePayload.payments && safePayload.payments[0] && safePayload.payments[0].credit_card && safePayload.payments[0].credit_card.card) {
      safePayload.payments[0].credit_card.card.number = '***';
      safePayload.payments[0].credit_card.card.cvv = '***';
  }
  console.log("🚀 [Pagarme] Payload Final do Pedido (Safe):", JSON.stringify(safePayload, null, 2));
  
  // LOG 4: Verificação dos recebedores no payload final
  const recIdsLog = `[AUDITORIA-IDS] Recebedores no Payload: ${splitArray.map((s: any) => s.recipient_id).join(', ')}\n`;
  process.stderr.write(recIdsLog);

  const splitSentInPayload = payload.payments[0][paymentMethod]?.splits;
  const splitAuditMsg = `[AUDITORIA-PAYLOAD-SPLITS] Payload de Splits enviado à Pagar.me em (${paymentMethod}): ${JSON.stringify(splitSentInPayload)}\n`;
  process.stderr.write(splitAuditMsg);

  try {
    console.log("[CHECKOUT] Iniciando criação de pedido via Axios padrão");
    
    let result;
    try {
      const pagarme = await getPagarmeClient();
      const response = await pagarme.post('/orders', payload);
      result = response.data;
      
      // LOG EXTRA SOLICITADO: Capturar confirmação de split na resposta
      const chargeInside = result.charges?.[0];
      const splitConfirmed = chargeInside?.split || chargeInside?.splits;
      process.stdout.write(`>>>> [PAGARME-RES-SPLIT] Split na resposta: ${JSON.stringify(splitConfirmed)} <<<<\n`);
      
      // LOG DE RESPOSTA DA PAGAR.ME NO FIRESTORE (Após o envio)
      try {
        const fullAudit = {
          status: 'success',
          productId: productIdLog,
          paymentMethod: paymentMethod,
          timestamp: new Date().toISOString(),
          finalPayload: safePayload,
          pagarme_response: result
        };
        await dbAdmin.collection('audit_splits').add(fullAudit);
        process.stdout.write(`>>>> [AUDITORIA-DB] Log de split (Sucesso) salvo para ${productIdLog} <<<<\n`);
      } catch (e) {
        console.error("Erro ao gravar audit_splits success:", e);
      }
      
    } catch (reqError: any) {
      console.error("[CRITICAL-CHECKOUT]", reqError.message);
      console.error("🚨 [Pagarme] FALHA CRÍTICA DE REDE/API NA CRIAÇÃO DO PEDIDO:", reqError.message);
      
      const errorResponse = reqError.response?.data || { message: reqError.message };
      
      // LOG DE RESPOSTA DE ERRO DA PAGAR.ME NO FIRESTORE
      try {
        const fullAudit = {
          status: 'error',
          errorMessage: reqError.message,
          productId: productIdLog,
          paymentMethod: paymentMethod,
          timestamp: new Date().toISOString(),
          finalPayload: safePayload,
          pagarme_response: errorResponse
        };
        await dbAdmin.collection('audit_splits').add(fullAudit);
        process.stdout.write(`>>>> [AUDITORIA-DB] Log de split (Erro) salvo para ${productIdLog} <<<<\n`);
      } catch (e) {
        console.error("Erro ao gravar audit_splits error:", e);
      }

      if (reqError.response) {
        console.error("🚨 [Pagarme] HTTP Status:", reqError.response.status);
        console.error("🚨 [Pagarme] Response Data do ERRO:", JSON.stringify(reqError.response.data, null, 2));
      }
      throw reqError; // Rethrow to be caught by the outer catch
    }

    // Check for payment failure in the charge
    const charge = result.charges?.[0];
    if (charge && (charge.status === 'failed' || charge.status === 'not_authorized')) {
      const declineReason = charge.last_transaction?.acquirer_message || charge.last_transaction?.status_details || 'Pagamento recusado pelo banco emissor.';
      console.warn('[Pagarme] Payment Refused:', declineReason);
      
      // Detalhamento do erro conforme solicitado pelo usuário
      console.error("🚨 [PAGARME CC ERRO DETALHADO]:", JSON.stringify(result.charges, null, 2));
      
      const error = new Error(declineReason);
      (error as any).status = 'failed';
      (error as any).pagarmeResponse = result;
      throw error;
    }

    if (result.status === 'paid') {
      console.log('[Pagarme] Order paid immediately. Provisioning access...');
      const customerData = {
        email: orderData.payer.email,
        name: orderData.payer.name,
        cpf: orderData.payer.document.replace(/\D/g, ''),
        phone: orderData.metadata.userPhone
      };
      const productId = orderData.productId || orderData.metadata.courseId || orderData.metadata.productId;
      
      if (productId) {
        try {
          await provisionPurchase(customerData, String(productId), 'pagarme');
          console.log('[Pagarme] Immediate provisioning success for:', customerData.email);
          
          // Registrar comissão para o afiliado/vendedor e relatório admin
          await recordAffiliateCommission(result);
          await recordAdminSalesReport(result);
          await recordCoproductionCommissions(result);
        } catch (err) {
          console.error('[Pagarme] Error provisioning immediate access:', err);
        }
      }
    }

    return result;
  } catch (error: any) {
    const errorLog = `[AUDITORIA-ERRO-CRITICO] ${JSON.stringify({
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      path: error.config?.url
    })}\n`;
    process.stdout.write(errorLog);

    if (error.response) {
      console.error('[Pagarme] API Error:', error.response.data);
      const result = error.response.data;
      const errorMessage = result.message || (result.errors && result.errors[0]?.message);
      
      console.error('[Pagarme] fetch error details:', {
        message: errorMessage || error.message,
        pagarmeResponse: JSON.stringify(result, null, 2)
      });
      throw new Error(errorMessage || 'Erro ao criar pedido no Pagar.me');
    }

    console.error('[Pagarme] fetch error details:', {
      message: error.message,
      stack: error.stack,
      pagarmeResponse: error.pagarmeResponse ? JSON.stringify(error.pagarmeResponse.charges, null, 2) : 'N/A'
    });
    throw error;
  }
};

export const createPagarmeTransaction = async (data: Record<string, any>) => {
  // Keeping this for compatibility but routing to createPagarmeOrder
  return createPagarmeOrder(data);
};

export const createPagarmeRecipient = async (data: Record<string, any>) => {
  console.log('[Pagarme] createRecipient called with:', data);
  throw new Error('Pagar.me service integration pending.');
};

export const getPagarmeRecipientBalance = async (recipientId: string) => {
  const actualRecipientId = (recipientId && recipientId !== 'undefined' && recipientId !== 'null') 
    ? recipientId 
    : await getMasterRecipientId();

  console.log(`[CARTEIRA] Consultando saldo real via API Pagar.me para: ${actualRecipientId}`);

  try {
    const pagarme = await getPagarmeClient();
    const response = await pagarme.get(`/recipients/${actualRecipientId.trim()}/balance`);
    const data = response.data;

    console.log(">>>> [DEBUG-CARTEIRA] JSON Bruto:", JSON.stringify(data));
    console.log(`>>>> [CARTEIRA-SUCESSO] Valor processado: R$ ${(data.available_amount || 0) / 100}`);

    return {
      available: data.available_amount || 0,
      waiting_funds: data.waiting_funds_amount || 0,
      transferred: data.transferred_amount || 0,
      total_sales: 0 // Note: Balance API does not provide historical gross sales
    };
  } catch (error: any) {
    if (error.response) {
      console.error('[CARTEIRA] Erro API Pagar.me Balance:', error.response.data);
    }
    console.error('[CARTEIRA] Exception in getPagarmeRecipientBalance via API:', error.message);
    
    // Retorna saldo zerado em caso de erro para não quebrar a UI
    return {
      available: 0,
      waiting_funds: 0,
      transferred: 0,
      total_sales: 0
    };
  }
};

export const requestPagarmeTransfer = async (recipientId: string, amount: number) => {
  const actualRecipientId = (recipientId && recipientId !== 'undefined' && recipientId !== 'null') 
    ? recipientId 
    : await getMasterRecipientId();

  console.log(`[Pagarme] Requesting transfer for recipient: ${actualRecipientId}, amount: ${amount}`);
  
  try {
    const pagarme = await getPagarmeClient();

    // 1. Log Detalhado do Recebedor
    try {
      const recipientInfoRes = await pagarme.get(`/recipients/${actualRecipientId.trim()}`);
      console.log(`[PAGARME-V5] Status do recebedor (${actualRecipientId}): ${recipientInfoRes.data?.status}`);
    } catch (err: any) {
      console.log(`[PAGARME-V5] Erro ao buscar status do recebedor:`, err.message);
    }

    // 2. Verificação de Saldo Disponível
    const balance = await getPagarmeRecipientBalance(actualRecipientId);
    console.log(`[PAGARME-V5] Saldo disponível (available) antes do saque: ${balance.available}`);
    
    if (balance.available < amount) {
      console.warn(`[PAGARME-V5] AVISO: Valor disponível (${balance.available}) é menor que o valor solicitado para saque (${amount}). Taxas ou repasses podem estar impactando.`);
    }

    // 3. Ajuste de Margem (Taxa de Saque)
    const PAGARME_TRANSFER_FEE = 367;
    const liquidAmount = amount - PAGARME_TRANSFER_FEE;
    
    if (liquidAmount <= 0) {
      throw new Error('Saldo insuficiente para cobrir a taxa de saque da Pagar.me (R$ 3,67).');
    }

    console.log(`[SAQUE] Valor Bruto: ${amount} | Taxa: ${PAGARME_TRANSFER_FEE} | Valor Líquido a Enviar: ${liquidAmount}`);

    console.log(`[PAGARME-V5] Tentando saque via rota de Recipient para o ID: ${actualRecipientId}`);
    
    const response = await pagarme.post(`/recipients/${actualRecipientId.trim()}/transfers`, {
        amount: liquidAmount
    }, {
        headers: {
            'Idempotency-Key': `saque_master_${Date.now()}`
        }
    });

    if (!response.data) throw new Error("A resposta final da Pagar.me foi vazia.");

    const result = response.data;

    console.log("[Pagarme] Saque solicitado com sucesso via API Pagar.me");

    return {
      ...result,
      liquidAmount,
      fee: PAGARME_TRANSFER_FEE
    };
  } catch (error: any) {
    if (error.response) {
      console.log("[RAIO-X-SAQUE] Status:", error.response?.status);
      console.log("[RAIO-X-SAQUE] Mensagem Bruta:", JSON.stringify(error.response?.data));
      console.log("[RAIO-X-SAQUE] Payload enviado:", JSON.stringify(error.config?.data));
      console.error('[Pagarme] Transfer API Error:', error.response.data?.message || 'Erro desconhecido');
      throw new Error(error.response.data?.message || 'Erro ao processar transferência. Verifique os logs.');
    }
    console.error('[Pagarme] Error requesting transfer:', error.message);
    throw error;
  }
};

export const getPagarmeOrderStatus = async (orderId: string) => {
  console.log(`[Pagarme] Checking status for order: ${orderId}`);
  
  try {
    const pagarme = await getPagarmeClient();
    const response = await pagarme.get(`/orders/${orderId}`);

    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('[Pagarme] Status Check API Error:', error.response.data);
      throw new Error('Erro ao consultar status no Pagar.me');
    }
    console.error('[Pagarme] Error checking order status:', error.message);
    throw error;
  }
};

export const handlePagarmeWebhook = async (payload: Record<string, any>) => {
  console.log('✅ [Pagarme] Webhook recebido:', payload.type);

  try {
    const eventType = payload.type;
    const orderData = payload.data;

    if (eventType === 'order.paid') {
      const email = orderData.metadata?.userEmail || orderData.customer.email;
      console.log(`🚀 [Pagarme] Processando order.paid para o e-mail: ${email}`);
      
      const customerData = {
        email: email,
        name: orderData.metadata?.userName || orderData.customer.name,
        cpf: orderData.customer.document || '',
        phone: orderData.metadata?.userPhone || (orderData.customer.phones?.mobile_phone 
          ? `${orderData.customer.phones.mobile_phone.country_code}${orderData.customer.phones.mobile_phone.area_code}${orderData.customer.phones.mobile_phone.number}`
          : '')
      };

      const productId = orderData.metadata?.courseId || orderData.metadata?.productId || orderData.metadata?.offerId;
      console.log(`🚀 [Pagarme] Extraído ProductID para provisionamento: ${productId}`);
      
      if (productId) {
        // Salva a ordem completa na coleção 'orders' para consulta de saldo baseada em split_rules
        try {
          const { dbAdmin } = getAdminConfig();
          await dbAdmin.collection('orders').doc(orderData.id).set({
            ...orderData,
            updatedAt: new Date().toISOString()
          });
          console.log(`✅ [Pagarme] Ordem ${orderData.id} persistida no Firestore.`);
        } catch (dbErr) {
          console.error('❌ [Pagarme] Erro ao persistir ordem no Firestore:', dbErr);
        }

        await provisionPurchase(customerData, String(productId), 'pagarme');
        
        // Novo: Registrar comissão no histórico do afiliado e relatório admin
        try {
          await recordAffiliateCommission(orderData);
          await recordAdminSalesReport(orderData);
          await recordCoproductionCommissions(orderData);
        } catch (commErr) {
          console.error('⚠️ [Pagarme] Erro ao registrar relatórios (não fatal):', commErr);
        }

        console.log("[WEBHOOK] Venda confirmada: Notification sent");

        return { success: true, message: 'Provisioning triggered' };
      } else {
        console.warn(`⚠️ [Pagarme] Webhook: Ordem paga (${orderData.id}) sem courseId/productId no metadata`);
      }
    }

    return { success: true, message: 'Webhook received' };
  } catch (error) {
    console.error('❌ [Pagarme] Erro ao processar webhook:', error);
    throw error;
  }
};

/**
 * Registra a comissão do afiliado no Firestore para fins de relatório.
 * Chamado quando um pedido é pago.
 */
async function recordAffiliateCommission(orderData: any) {
  const { dbAdmin } = getAdminConfig();
  const metadata = orderData.metadata || {};
  
  // refId é o identificador mestre do vendedor no sistema
  const affiliateId = metadata.refId || metadata.affiliateId;
  const courseId = metadata.courseId || metadata.productId;
  const offerId = metadata.offerId;

  if (!affiliateId || !courseId) {
    console.log(`[Commission] Pedido ${orderData.id} ignorado (sem affiliateId ou courseId no metadata).`);
    return;
  }

  try {
    // 1. Busca as regras do produto para garantir que estamos aplicando o percentual correto
    const productDoc = await dbAdmin.collection('ticto_products').doc(courseId).get();
    if (!productDoc.exists) {
      console.error(`[Commission] Produto ${courseId} não encontrado em ticto_products.`);
      return;
    }

    const courseData = productDoc.data();
    const offersArray = courseData?.offers || [];
    const currentOffer = offersArray.find((offer: any) => String(offer.id) === String(offerId));
    
    // Percentual exato do vendedor extraído da oferta
    const percentualVendedor = currentOffer && currentOffer.isAffiliationEnabled 
      ? (Number(currentOffer.affiliateCommission) || 0) 
      : 0;

    if (percentualVendedor <= 0) {
      console.log(`[Commission] Pedido ${orderData.id}: Comissao zero ou afiliacao desativada.`);
      return;
    }

    const grossAmount = orderData.amount; // Valor em centavos
    const paymentMethod = orderData.charges?.[0]?.payment_method || orderData.payment_method || 'unknown';
    const installments = orderData.charges?.[0]?.last_transaction?.installments || 1;

    // 2. Cálculo do "Saldo A" (Dedução em Cascata)
    const pagarmeFee = calculatePagarmeFees(grossAmount, paymentMethod, installments);
    const saldoA = grossAmount - pagarmeFee;
    const commissionEarned = Math.floor(saldoA * (percentualVendedor / 100));

    // EXTRAÇÃO DE DADOS DO CLIENTE PARA O RELATÓRIO
    const customerName = orderData.metadata?.userName || orderData.customer?.name || 'Cliente';
    const customerEmail = orderData.metadata?.userEmail || orderData.customer?.email || 'N/A';
    const customerPhone = orderData.metadata?.userPhone || 
      (orderData.customer?.phones?.mobile_phone 
        ? `+${orderData.customer.phones.mobile_phone.country_code}${orderData.customer.phones.mobile_phone.area_code}${orderData.customer.phones.mobile_phone.number}`
        : 'N/A');

    // 3. Salva na coleção solicitada: affiliate_commissions
    await dbAdmin.collection('affiliate_commissions').add({
      affiliateId,
      orderId: orderData.id,
      courseId,
      courseName: currentOffer?.title || courseData?.name || 'Produto Digital',
      grossValue: grossAmount,
      commissionEarned: commissionEarned,
      paymentMethod,
      customerName,
      customerEmail,
      customerPhone,
      createdAt: new Date().toISOString()
    });

    // Enviar Notificação Push para o Afiliado/Vendedor
    const valFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commissionEarned / 100);
    await sendPushNotification(
      affiliateId,
      "VENDA REALIZADA! 🚀",
      `Você acabou de ganhar uma comissão de ${valFormatted}. Confira seu saldo!`,
      "/comercial/dashboard-afiliado"
    );

    console.log(`✅ [DEBUG COMISSÃO] Afiliado: ${affiliateId} | Pedido: ${orderData.id} | Valor: ${commissionEarned} centavos`);
  } catch (error) {
    console.error('❌ [ERRO COMISSÃO] Falha ao salvar no Firestore:', error);
  }
}

/**
 * Registra inteligência financeira detalhada para o administrador.
 * Calcula o lucro líquido real da empresa após todas as deduções (taxas, afiliados, coprodutores).
 */
async function recordAdminSalesReport(orderData: any) {
  const { dbAdmin } = getAdminConfig();
  const metadata = orderData.metadata || {};
  
  const courseId = metadata.courseId || metadata.productId;
  const offerId = metadata.offerId;

  if (!courseId) {
    console.warn(`[AdminReport] Pedido ${orderData.id} ignorado (sem courseId).`);
    return;
  }

  try {
    // 1. Busca as regras do produto para cálculos precisos
    const productDoc = await dbAdmin.collection('ticto_products').doc(courseId).get();
    if (!productDoc.exists) return;

    const courseData = productDoc.data();
    const offersArray = courseData?.offers || [];
    const currentOffer = offersArray.find((offer: any) => String(offer.id) === String(offerId));

    const grossAmount = orderData.amount; // Valor em centavos
    const paymentMethod = orderData.charges?.[0]?.payment_method || orderData.payment_method || 'unknown';
    const installments = orderData.charges?.[0]?.last_transaction?.installments || 1;

    // 2. Cálculo de Taxa Gateway e Saldo A (Cascata)
    const gatewayFee = calculatePagarmeFees(grossAmount, paymentMethod, installments);
    const saldoA = grossAmount - gatewayFee;

    // 3. Cálculo da Parte do Vendedor (Afiliado)
    const affiliatePercentage = currentOffer && currentOffer.isAffiliationEnabled 
      ? (Number(currentOffer.affiliateCommission) || 0) 
      : 0;
    const affiliatePart = Math.floor(saldoA * (affiliatePercentage / 100));

    // 4. Cálculo da Parte dos Coprodutores (Cascata - Saldo B)
    let coproductionPart = 0;
    const saldoB = saldoA - affiliatePart;
    const coproducers = currentOffer?.coproducers || courseData?.coproduction || [];
    
    if (Array.isArray(coproducers)) {
      coproducers.forEach((copro: any) => {
        const percentage = Number(copro.percentage) || 0;
        if (percentage > 0) {
          coproductionPart += Math.floor(saldoB * (percentage / 100));
        }
      });
    }

    // 5. O SANTOGRÁAL: Lucro Líquido da Insanus (Empresa)
    // Bruto - Taxas - Afiliado - Coprodutores
    const netCompanyValue = grossAmount - gatewayFee - affiliatePart - coproductionPart;

    // 6. Dados do Cliente para Follow-up do Admin
    const customerData = {
      name: orderData.metadata?.userName || orderData.customer?.name || 'Cliente',
      email: orderData.metadata?.userEmail || orderData.customer?.email || 'N/A',
      phone: orderData.metadata?.userPhone || 
        (orderData.customer?.phones?.mobile_phone 
          ? `+${orderData.customer.phones.mobile_phone.country_code}${orderData.customer.phones.mobile_phone.area_code}${orderData.customer.phones.mobile_phone.number}`
          : 'N/A')
    };

    // 7. Salva o relatório financeiro mestre
    await dbAdmin.collection('admin_sales_report').add({
      orderId: orderData.id,
      courseId,
      courseName: currentOffer?.title || courseData?.name || 'Produto Digital',
      grossValue: grossAmount,
      gatewayFee,
      affiliatePart,
      coproductionPart,
      netCompanyValue,
      customerData,
      createdAt: new Date().toISOString()
    });

    // Registra na coleção transactions para unificação de saldo
    const masterRecipientId = await getMasterRecipientId();
    await dbAdmin.collection('transactions').add({
      type: 'master',
      recipientId: masterRecipientId,
      orderId: orderData.id,
      courseId,
      courseName: currentOffer?.title || courseData?.name || 'Produto Digital',
      netCompanyValue,
      grossValue: grossAmount,
      status: 'paid',
      createdAt: new Date().toISOString()
    });

    console.log(`✅ [ADMIN REPORT] Venda registrada. Líquido Insanus: ${netCompanyValue} centavos`);

    // Enviar notificação push para os administradores/proprietários
    try {
      const adminsSnapshot = await dbAdmin.collection('users').where('role', 'in', ['admin', 'owner']).get();
      const adminValFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netCompanyValue / 100);
      const pushPromises = adminsSnapshot.docs.map((doc: any) => {
        return sendPushNotification(
          doc.id,
          "NOVA VENDA CONFIRMADA! 💸",
          `Recebemos uma nova venda do produto ${currentOffer?.title || courseData?.name}. Lucro Líquido: ${adminValFormatted}.`,
          "/admin/dashboard"
        ).catch((e: any) => console.log("[PUSH] Erro ao enviar para admin:", e));
      });
      await Promise.all(pushPromises);
      console.log("[WEBHOOK] Venda confirmada: Notification sent (Admin)");
    } catch (pushErr) {
      console.log("[PUSH ERROR] Falha ao notificar admins:", pushErr);
    }
  } catch (error) {
    console.error('❌ [ADMIN REPORT ERROR] Falha ao registrar relatório financeiro:', error);
  }
}

/**
 * Registra comissões individuais para cada coprodutor no Firestore.
 */
async function recordCoproductionCommissions(orderData: any) {
  const { dbAdmin } = getAdminConfig();
  const metadata = orderData.metadata || {};
  
  const courseId = metadata.courseId || metadata.productId;
  const offerId = metadata.offerId;

  if (!courseId) return;

  try {
    // 1. Busca as regras do produto para cálculos precisos
    const productDoc = await dbAdmin.collection('ticto_products').doc(courseId).get();
    if (!productDoc.exists) return;

    const courseData = productDoc.data();
    const offersArray = courseData?.offers || [];
    const currentOffer = offersArray.find((offer: any) => String(offer.id) === String(offerId));

    const grossAmount = orderData.amount; // Valor em centavos
    const paymentMethod = orderData.charges?.[0]?.payment_method || orderData.payment_method || 'unknown';
    const installments = orderData.charges?.[0]?.last_transaction?.installments || 1;

    // 2. Cálculo das Taxas e Saldo em Cascata
    const gatewayFee = calculatePagarmeFees(grossAmount, paymentMethod, installments);
    const saldoA = grossAmount - gatewayFee;

    // 3. Cálculo da Parte do Vendedor (Afiliado) para determinar a base de coprodução
    const affiliatePercentage = currentOffer && currentOffer.isAffiliationEnabled 
      ? (Number(currentOffer.affiliateCommission) || 0) 
      : 0;
    const affiliatePart = Math.floor(saldoA * (affiliatePercentage / 100));

    // 4. Cálculo e Registro da Parte dos Coprodutores
    const saldoB = saldoA - affiliatePart;
    
    // Sincronização com CoproductionDashboard e ProductFormModal field names
    const coproducers = currentOffer?.coproducers || courseData?.coproduction || courseData?.coproducers || courseData?.splits || [];
    
    if (Array.isArray(coproducers) && coproducers.length > 0) {
      const batch = dbAdmin.batch();
      let hasEntries = false;

      coproducers.forEach((copro: any) => {
        const percentage = Number(copro.percentage) || 0;
        if (percentage > 0) {
          const commissionValue = Math.floor(saldoB * (percentage / 100));
          if (commissionValue > 0) {
            const userId = copro.coproducerId || copro.userId || copro.id || 'unknown';
            
            // Registra na coleção antiga para compatibilidade
            const commRef = dbAdmin.collection('coproduction_commissions').doc();
            batch.set(commRef, {
              coproducerId: userId,
              coproducerName: copro.coproducerName || copro.name || 'Coprodutor',
              orderId: orderData.id,
              courseId,
              courseName: currentOffer?.title || courseData?.name || 'Produto Digital',
              commissionValue,
              grossValue: grossAmount, // new
              status: 'paid', // new
              createdAt: new Date().toISOString()
            });

            // Registra na coleção transactions solicitada pelo usuário
            const txRef = dbAdmin.collection('transactions').doc();
            const recipientId = copro.pagarmeRecipientId || copro.recipientId || '';
            
            console.log(`[WEBHOOK DEBUG] Gravando split para o recebedor: ${recipientId} no valor: ${commissionValue}`);

            batch.set(txRef, {
              type: 'coproduction',
              userId: userId,
              recipientId: recipientId,
              orderId: orderData.id,
              courseId,
              courseName: currentOffer?.title || courseData?.name || 'Produto Digital',
              commissionValue,
              grossValue: grossAmount,
              status: 'paid',
              createdAt: new Date().toISOString()
            });
            
            // Enviar Notificação Push para o Coprodutor
            const coproId = userId;
            if (coproId && coproId !== 'unknown') {
              const valFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commissionValue / 100);
              sendPushNotification(
                coproId,
                "COMISSÃO DE COPRODUÇÃO! 🚀",
                `Venda realizada! Você acaba de receber ${valFormatted} em comissão.`,
                "/comercial/dashboard-coprodutor"
              ).catch(e => console.error("Erro push copro:", e));
            }

            hasEntries = true;
          }
        }
      });

      if (hasEntries) {
        await batch.commit();
        console.log(`✅ [COPRO REPORT] ${coproducers.length} comissões individuais de coprodução registradas para o pedido ${orderData.id}`);
      }
    }
  } catch (error) {
    console.error('❌ [COPRO REPORT ERROR] Falha ao registrar comissões de coprodução:', error);
  }
}
