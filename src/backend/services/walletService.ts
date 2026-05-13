
import { getAdminConfig } from './firebaseAdmin.js';

/**
 * [INTEGRIDADE] Sistema operando em modo estável
 * walletService.ts - Serviço de cálculo de saldo seguro e leitura de transações.
 */

export const calculateRecipientBalance = async (recipientId: string, email?: string) => {
  console.log(`[INTEGRIDADE] Iniciando cálculo de saldo ReadOnly para: ${recipientId} ${email ? `| Email: ${email}` : ''}`);
  
  const { dbAdmin } = getAdminConfig();
  let totalAvailable = 0;
  let grossTotal = 0;

  try {
    // 1. Consulta a coleção 'orders' (Filtro por status: paid ou succeeded)
    const ordersSnap = await dbAdmin.collection('orders')
      .where('status', 'in', ['paid', 'succeeded'])
      .get();

    console.log(`[INTEGRIDADE] Analisando ${ordersSnap.size} ordens pagas para calcular split do recebedor ${recipientId}`);

    const normalizedEmail = email?.toLowerCase();

    ordersSnap.forEach((doc: any) => {
      const order = doc.data();
      const splits = order.split_rules || order.splits || [];
      
      // A. Localiza o split destinado ao recipientId
      const mySplit = splits.find((s: any) => s.recipient_id === recipientId);
      
      if (mySplit) {
        const amount = mySplit.amount || 0;
        totalAvailable += amount;
        grossTotal += (order.amount || 0);
        console.log(`[SPLIT] Processando regras para o recebedor ${recipientId} na ordem ${order.id}: +${amount} centavos`);
      } else if (normalizedEmail) {
        // B. Fallback por Email nos Metadados (Security requirement #3)
        const metadata = order.metadata || {};
        const orderEmail = (metadata.userEmail || metadata.email || metadata.affiliateEmail || '').toLowerCase();
        
        if (orderEmail === normalizedEmail) {
           // Se o email bate mas o split não foi encontrado, pode ser que o recipientId tenha mudado ou não mapeado
           // No entanto, o saldo por split é o mais seguro. 
           // Aqui vamos apenas registrar que houve um match por email para auditoria.
           console.log(`[INTEGRIDADE] Ordem ${order.id} corresponde ao email ${normalizedEmail}, mas recipientId ${recipientId} não consta nos splits.`);
        }
      }
    });

    // 2. Deduz saques realizados (withdrawals)
    const withdrawalsSnap = await dbAdmin.collection('withdrawals')
      .where('recipientId', '==', recipientId)
      .get();

    withdrawalsSnap.forEach((doc: any) => {
      const withdrawal = doc.data();
      const amount = withdrawal.amount || 0;
      totalAvailable -= amount;
      console.log(`[INTEGRIDADE] Deduzindo saque realizado: -${amount} centavos`);
    });

    return {
      available: Math.max(0, totalAvailable),
      total_sales: grossTotal,
      waiting_funds: 0, // Implementar se houver lógica de antecipação futura
      transferred: 0
    };
  } catch (error: any) {
    console.error(`[CRÍTICO] Falha ao calcular saldo ReadOnly: ${error.message}`);
    throw new Error('Erro na integridade do cálculo de saldo');
  }
};
