import { getAdminConfig } from './firebaseAdmin.js';
import { sendWelcomeEmail, sendAccessNotificationEmail } from './emailService.js';
import crypto from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

interface CustomerData {
  email: string;
  name: string;
  document_number?: string;
  cpf?: string;
  phone?: string | { ddi?: string; ddd?: string; number?: string };
  phone_number?: string;
  cellphone?: string;
  full_phone?: string;
  contact?: {
    phone?: string;
    phone_number?: string;
    cellphone?: string;
  };
}

interface UserAccess {
  id: string;
  type: string;
  targetId: string;
  externalId: string;
  title: string;
  days: number;
  diaInicio: Timestamp | FieldValue;
  diaFim: Timestamp | FieldValue;
  isActive: boolean;
  resources?: {
    plans?: string[];
    onlineCourses?: string[];
    presentialClasses?: string[];
    simulated?: string[];
    liveEvents?: string[];
  };
  orderIndex?: number;
  revokedAt?: Date;
  sourceProductId?: string; // ID do documento de acesso do Produto que gerou estes sub-recursos
}

interface Resources {
  plans?: string[];
  onlineCourses?: string[];
  presentialClasses?: string[];
  simulated?: string[];
  liveEvents?: string[];
}

export const provisionPurchase = async (customerData: CustomerData, targetId: string, origin: 'ticto' | 'mp' | 'pagarme' = 'pagarme') => {
  const { dbAdmin, authAdmin } = getAdminConfig();
  try {
    const safeTargetId = String(targetId);
    const cpf = customerData.document_number || customerData.cpf || '';
    
    const getPhone = (data: CustomerData) => {
      const p = data.phone || data.phone_number || data.cellphone || data.full_phone || 
                (data.contact && (data.contact.phone || data.contact.phone_number || data.contact.cellphone));
      if (!p) return '';
      if (typeof p === 'object') {
        return `${p.ddi || ''}${p.ddd || ''}${p.number || ''}`.replace(/\D/g, '');
      }
      return String(p).replace(/\D/g, '');
    };
    const phone = getPhone(customerData);

    console.log(`Iniciando provisionamento (${origin}) para: ${customerData.email}`);

    let accessDays = 365;
    let productName = 'Conteúdo Digital';
    let linkedResources: Resources = {
      plans: [],
      onlineCourses: [],
      presentialClasses: [],
      simulated: [],
      liveEvents: []
    };
    let productDocId = '';

    if (origin === 'ticto' || origin === 'mp' || origin === 'pagarme') {
      console.log(`[PROVISIONING] 🔍 Buscando produto para ID: ${safeTargetId}`);
      
      // 1. Tentar na coleção unificada 'products' (por externalId)
      const productsSnapshot = await dbAdmin.collection('products')
        .where('externalId', '==', safeTargetId)
        .limit(1)
        .get();

      if (!productsSnapshot.empty) {
        const productDoc = productsSnapshot.docs[0];
        productDocId = productDoc.id;
        const productData = productDoc.data();
        productName = productData.name;
        accessDays = productData.accessDays || 365;
        linkedResources = productData.linkedResources || linkedResources;
        console.log(`[PROVISIONING] ✅ Produto encontrado em 'products': ${productName}`);
      } else {
        // 2. Tentar na coleção 'ticto_products' (Principal) - Por ID de Documento
        const tictoProductSnap = await dbAdmin.collection('ticto_products').doc(safeTargetId).get();
        if (tictoProductSnap.exists) {
          const productData = tictoProductSnap.data();
          productDocId = tictoProductSnap.id;
          productName = productData?.name || productData?.title || 'Produto';
          accessDays = productData?.accessDays || productData?.validity || 365;
          
          if (productData?.linkedResources) {
            linkedResources = productData.linkedResources;
          } else {
            linkedResources.onlineCourses.push(safeTargetId);
          }
          console.log(`[PROVISIONING] ✅ Produto encontrado em 'ticto_products': ${productName}`);
        } else {
          // 2.1 Tentar buscar se o safeTargetId é um 'offerId' dentro de algum documento de 'ticto_products'
          const offerSearchSnap = await dbAdmin.collection('ticto_products').get();
          let foundByOffer = false;
          
          for (const doc of offerSearchSnap.docs) {
            const data = doc.data();
            const offers = data.offers || [];
            const matchingOffer = offers.find((o: any) => String(o.id) === safeTargetId);
            
            if (matchingOffer) {
              productDocId = doc.id;
              productName = matchingOffer.title || data.name || 'Produto via Oferta';
              accessDays = matchingOffer.accessDays || data.accessDays || data.validity || 365;
              linkedResources = data.linkedResources || { onlineCourses: [doc.id] };
              foundByOffer = true;
              console.log(`[PROVISIONING] ✅ Produto encontrado via Oferta (${safeTargetId}) em 'ticto_products': ${productName}`);
              break;
            }
          }

          if (!foundByOffer) {
            // 3. Fallback para coleções diretas (online_courses)
            const courseSnap = await dbAdmin.collection('online_courses').doc(safeTargetId).get();
            if (courseSnap.exists) {
              const courseData = courseSnap.data();
              productName = courseData?.title || 'Curso Online';
              linkedResources.onlineCourses.push(safeTargetId);
              console.log(`[PROVISIONING] ✅ Curso encontrado em 'online_courses': ${productName}`);
            } else {
              // 4. Fallback final: Tentar ID direto na coleção products
              const directProductSnap = await dbAdmin.collection('products').doc(safeTargetId).get();
              if (directProductSnap.exists) {
                const productData = directProductSnap.data();
                productDocId = directProductSnap.id;
                productName = productData?.name || 'Produto';
                accessDays = productData?.accessDays || 365;
                linkedResources = productData?.linkedResources || linkedResources;
                console.log(`[PROVISIONING] ✅ Produto encontrado via ID em 'products': ${productName}`);
              } else {
                console.warn(`[PROVISIONING] ⚠️ AVISO: Alvo ${safeTargetId} não localizado em NENHUMA coleção. Access array ficará vazio.`);
              }
            }
          }
        }
      }
    }

    // Calcular data de expiração
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + accessDays);

    // Preparar array de acessos
    const accessesToGrant: UserAccess[] = [];
    let productAccessId = '';

    // Se for um produto (combo), adiciona o cabeçalho do produto
    if (productDocId) {
      productAccessId = crypto.randomUUID();
      accessesToGrant.push({
        id: productAccessId,
        type: 'product',
        targetId: productDocId,
        externalId: origin === 'ticto' ? safeTargetId : '',
        title: productName,
        days: accessDays,
        diaInicio: Timestamp.now(),
        diaFim: Timestamp.fromDate(expirationDate),
        isActive: true,
        resources: linkedResources
      });
    }

    // ACHATAMENTO (Flattening)
    const resourcesArray: { id: string; type: string }[] = [];
    if (linkedResources.plans) linkedResources.plans.forEach((id: string) => resourcesArray.push({ id, type: 'plan' }));
    if (linkedResources.onlineCourses) linkedResources.onlineCourses.forEach((id: string) => resourcesArray.push({ id, type: 'course' }));
    if (linkedResources.simulated) linkedResources.simulated.forEach((id: string) => resourcesArray.push({ id, type: 'simulated_class' }));
    if (linkedResources.presentialClasses) linkedResources.presentialClasses.forEach((id: string) => resourcesArray.push({ id, type: 'presential_class' }));
    if (linkedResources.liveEvents) linkedResources.liveEvents.forEach((id: string) => resourcesArray.push({ id, type: 'live_event' }));

    for (let index = 0; index < resourcesArray.length; index++) {
      const res = resourcesArray[index];
      let realName = 'Acesso Liberado';
      let collectionName = '';
      
      switch(res.type) {
        case 'course': collectionName = 'online_courses'; break;
        case 'plan': collectionName = 'plans'; break;
        case 'simulated_class': collectionName = 'simulatedClasses'; break;
        case 'presential_class': collectionName = 'classes'; break;
        case 'live_event': collectionName = 'live_events'; break;
      }

      if (collectionName) {
        try {
          const docSnap = await dbAdmin.collection(collectionName).doc(res.id).get();
          if (docSnap.exists) {
            const data = docSnap.data();
            realName = data?.title || data?.name || realName;
          }
        } catch (err) {
          console.error(`Erro ao buscar nome do recurso:`, err);
        }
      }

      accessesToGrant.push({
        id: crypto.randomUUID(),
        targetId: res.id,
        type: res.type,
        title: realName,
        days: accessDays,
        isActive: true,
        externalId: origin === 'ticto' ? safeTargetId : '',
        diaInicio: Timestamp.now(),
        diaFim: Timestamp.fromDate(expirationDate),
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(expirationDate),
        orderIndex: index,
        sourceProductId: productAccessId // Vincula ao produto pai se existir
      });
    }

    // Lógica de usuário (Novo vs Existente) - REAPROVEITADA
    let userRecord;
    let isNewUser = false;

    try {
      userRecord = await authAdmin.getUserByEmail(customerData.email);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'auth/user-not-found') isNewUser = true;
      else throw error;
    }

    if (isNewUser) {
      // Gerar senha temporária alfanumérica de 8 caracteres
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let generatedPassword = '';
      for (let i = 0; i < 8; i++) {
        generatedPassword += charset.charAt(Math.floor(Math.random() * charset.length));
      }

      userRecord = await authAdmin.createUser({
        email: customerData.email,
        password: generatedPassword,
        displayName: customerData.name,
      });

      console.log(`[PROVISIONING] ✅ Conta criada com sucesso para: ${customerData.email}`);

      const productsToGrant = accessesToGrant.filter(a => a.type === 'product');
      const regularAccessToGrant = accessesToGrant.filter(a => a.type !== 'product');

      const newUserDoc = {
        uid: userRecord.uid,
        name: customerData.name,
        email: customerData.email,
        cpf: cpf,
        contact: phone,
        role: 'student',
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        access: regularAccessToGrant,
        products: productsToGrant
      };

      await dbAdmin.collection('users').doc(userRecord.uid).set(newUserDoc);
      await sendWelcomeEmail(customerData.name, customerData.email, generatedPassword, productName);
      console.log(`[PROVISIONING] ✅ E-mail de Boas-vindas enviado para: ${customerData.email}`);
    } else {
      const userRef = dbAdmin.collection('users').doc(userRecord.uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};
      
      const productsToGrant = accessesToGrant.filter(a => a.type === 'product');
      const regularAccessToGrant = accessesToGrant.filter(a => a.type !== 'product');
      
      const updateData: Record<string, any> = { 
        status: 'active'
      };

      if (regularAccessToGrant.length > 0) {
        updateData.access = FieldValue.arrayUnion(...regularAccessToGrant);
      }
      
      if (productsToGrant.length > 0) {
        updateData.products = FieldValue.arrayUnion(...productsToGrant);
      }
      
      if (!userData.cpf && cpf) updateData.cpf = cpf;
      if (!userData.contact && phone) updateData.contact = phone;

      await userRef.update(updateData);
      console.log(`[PROVISIONING] ✅ Acesso atualizado para aluno antigo: ${customerData.email}`);
      await sendAccessNotificationEmail(userData.name || customerData.name, customerData.email, productName);
      console.log(`[PROVISIONING] ✅ E-mail de Nova Compra enviado para: ${customerData.email}`);
    }

    // 4. CRIAR REGISTRO NA COLEÇÃO 'enrollments' (HISTÓRICO DE LIBERAÇÃO)
    try {
      const enrollmentData = {
        userId: userRecord.uid,
        userName: customerData.name,
        userEmail: customerData.email,
        productId: productDocId || safeTargetId,
        productName: productName,
        origin: origin,
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(expirationDate),
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        accessDetails: accessesToGrant // Cópia dos acessos específicos liberados
      };

      await dbAdmin.collection('enrollments').add(enrollmentData);
      console.log(`[PROVISIONING] ✅ Registro criado na coleção 'enrollments' para ${customerData.email}`);

      // Também criar na coleção 'user_courses' para compatibilidade direta se for um curso
      const courseAccesses = accessesToGrant.filter(a => a.type === 'course');
      for (const courseAcc of courseAccesses) {
        await dbAdmin.collection('user_courses').add({
          userId: userRecord.uid,
          userEmail: customerData.email,
          courseId: courseAcc.targetId,
          courseName: courseAcc.title,
          startDate: courseAcc.diaInicio,
          endDate: courseAcc.diaFim,
          isActive: true,
          enrolledAt: FieldValue.serverTimestamp()
        });
      }
      if (courseAccesses.length > 0) {
        console.log(`[PROVISIONING] ✅ Registros criados na coleção 'user_courses' (${courseAccesses.length})`);
      }
    } catch (enrollErr) {
      console.error('[PROVISIONING] ⚠️ Erro ao criar registros extras (enrollments/user_courses):', enrollErr);
    }

    return { success: true };
  } catch (error) {
    console.error('Erro no provisionamento geral:', error);
    throw error;
  }
};

export const provisionExternalPurchase = async (customerData: CustomerData, externalProductId: string) => {
  return provisionPurchase(customerData, externalProductId, 'ticto');
};

export const revokePurchase = async (email: string, externalProductId: string) => {
  const { dbAdmin, authAdmin } = getAdminConfig();
  try {
    const safeProductId = String(externalProductId);
    // 1. Busca o documento do produto na coleção products para saber quais recursos ele liberava
    const productsSnapshot = await dbAdmin.collection('products')
      .where('externalId', '==', safeProductId)
      .limit(1)
      .get();

    if (productsSnapshot.empty) {
      console.log(`[REVOGAÇÃO] Produto com externalId ${safeProductId} não encontrado.`);
    }

    // 2. Busca o utilizador na coleção users através do e-mail
    let userRecord;
    try {
      userRecord = await authAdmin.getUserByEmail(email);
    } catch (error: unknown) {
      const authError = error as { code: string };
      if (authError.code === 'auth/user-not-found') {
        console.log(`[REVOGAÇÃO] Usuário com e-mail ${email} não encontrado no Auth.`);
        return { success: false, message: 'Usuário não encontrado.' };
      }
      throw error;
    }

    const userRef = dbAdmin.collection('users').doc(userRecord.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`[REVOGAÇÃO] Documento do usuário ${email} não encontrado no Firestore.`);
      return { success: false, message: 'Documento do usuário não encontrado.' };
    }

    const userData = userDoc.data() || {};
    const currentAccess = (userData.access || []) as UserAccess[];
    // _currentProducts is not used but kept for reference
    // const _currentProducts = userData.products || [];

    // 3. Percorre o array access do utilizador. Para cada item de acesso que corresponda ao produto cancelado, ou que foi gerado por ele, altere a propriedade isActive para false
    let hasChanges = false;
    
    // Primeiro, identificamos o ID do registro de acesso do produto principal
    const productAccessItems = currentAccess.filter(acc => acc.externalId === safeProductId && acc.type === 'product');
    const productAccessIds = productAccessItems.map(p => p.id);

    const updatedAccess = currentAccess.map((acc: UserAccess) => {
      const isDirectMatch = acc.externalId === safeProductId;
      const isChildMatch = acc.sourceProductId && productAccessIds.includes(acc.sourceProductId);

      if ((isDirectMatch || isChildMatch) && acc.isActive !== false) {
        hasChanges = true;
        return { ...acc, isActive: false, revokedAt: new Date() };
      }
      return acc;
    });

    if (hasChanges) {
      // 4. Salva o array access atualizado no documento do utilizador
      await userRef.update({ access: updatedAccess });
      console.log(`[REVOGAÇÃO] Acessos revogados para o usuário ${email} referente ao produto ${safeProductId}`);
    } else {
      console.log(`[REVOGAÇÃO] Nenhum acesso ativo encontrado para revogar do usuário ${email} referente ao produto ${safeProductId}`);
    }

    return { success: true, message: 'Revogação concluída com sucesso.' };

  } catch (error) {
    console.error('Erro na revogação:', error);
    throw error;
  }
};
