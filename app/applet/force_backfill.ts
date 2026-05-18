import { getAdminConfig, initializeFirebaseAdmin } from './src/backend/services/firebaseAdmin.js';

async function run() {
  initializeFirebaseAdmin();
  const { dbAdmin } = getAdminConfig();
  
  // Transações do dia 14 ao 18 (pegamos 14 pra frente só pra garantir)
  const snapshot = await dbAdmin.collection('admin_sales_report')
    .where('orderId', 'in', ['4403948868', '4404037121', '4396777804']) 
    .get();

  console.log(`Found ${snapshot.size} missing test sales.`);
  
  const productCache = new Map();

  for (const doc of snapshot.docs) {
    const sale = doc.data();
    const existing = await dbAdmin.collection('coproduction_commissions')
      .where('orderId', '==', sale.orderId)
      .limit(1)
      .get();
      
    if (!existing.empty) continue;

    let pData = productCache.get(sale.courseId);
    if (!pData) {
        let prodDoc = await dbAdmin.collection('ticto_products').doc(sale.courseId).get();
        if (!prodDoc.exists) prodDoc = await dbAdmin.collection('products').doc(sale.courseId).get();
        if (prodDoc.exists) {
            pData = prodDoc.data();
            productCache.set(sale.courseId, pData);
        }
    }

    if (!pData) continue;

    const pool = sale.grossValue - (sale.gatewayFee || 0); // Pagarme fee
    let safeAffiliatePart = Number(sale.affiliatePart) || 0;
    const poolForCopro = pool - safeAffiliatePart;

    const coproSource = pData?.coproduction || pData?.coproducers || [];
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
        
        await dbAdmin.collection('coproduction_commissions').add({
            coproducerId: identifier,
            recipientId: recipientId,
            orderId: sale.orderId,
            orderCode: sale.orderId.substring(0, 8),
            courseId: sale.courseId,
            courseName: sale.courseName || pData.name || 'Produto',
            commissionValue: commissionValue, 
            grossValue: sale.grossValue,
            paymentMethod: 'pix',
            customerName: sale.customerData?.name || 'Cliente',
            customerEmail: sale.customerData?.email || 'N/A',
            customerPhone: sale.customerData?.phone || 'N/A',
            createdAt: sale.createdAt,
            status: 'paid'
        });
        console.log(`[BACKFILL] Created record for ${identifier}: ${commissionValue}`);
        }
    }
  }
}
run().catch(console.error);
