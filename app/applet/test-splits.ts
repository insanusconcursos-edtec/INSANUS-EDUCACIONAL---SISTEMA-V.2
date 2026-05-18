import { getAdminConfig, initializeFirebaseAdmin } from './src/backend/services/firebaseAdmin.js';

async function run() {
  initializeFirebaseAdmin();
  const { dbAdmin } = getAdminConfig();
  
  // Find today's sales from admin
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snapshot = await dbAdmin.collection('admin_sales_report')
    .where('createdAt', '>=', today.toISOString())
    .get();

  console.log(`Found ${snapshot.size} sales today.`);
  
  const productCache = new Map();

  for (const doc of snapshot.docs) {
    const sale = doc.data();
    
    // Check if coproduction was already saved for this order
    const existing = await dbAdmin.collection('coproduction_commissions')
      .where('orderId', '==', sale.orderId)
      .limit(1)
      .get();
      
    if (!existing.empty) {
      console.log(`Order ${sale.orderId} already has commissions registered.`);
      continue;
    }

    console.log(`Order ${sale.orderId} is missing commissions! Backfilling...`);

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

    // Fallback calculation logic from pagarmeService for backfill
    const pool = sale.grossValue - sale.gatewayFee;
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
          paymentMethod: 'pix', // fallback assumed from today's screens
          customerName: sale.customerData?.name || 'Cliente',
          customerEmail: sale.customerData?.email || 'N/A',
          customerPhone: sale.customerData?.phone || 'N/A',
          createdAt: sale.createdAt,
          status: 'paid'
        });
        
        console.log(`Created backfill for ${identifier}: ${commissionValue}`);
      }
    }
  }
}

run().catch(console.error);
