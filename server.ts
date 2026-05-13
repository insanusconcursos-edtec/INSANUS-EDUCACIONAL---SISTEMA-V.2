import express from 'express';
import path from 'path';

console.log(">>>> [REMIX-BOOT] Iniciando checkout seguro <<<<");

import { fetchPandaVideoTranscription } from './src/backend/services/pandaVideoService.js';
import { generateStudyMaterial } from './src/backend/services/geminiService.js';
import { getAdminConfig } from './src/backend/services/firebaseAdmin.js';
import { provisionExternalPurchase, revokePurchase } from './src/backend/services/provisioningService.js';
import { createPagarmeOrder, handlePagarmeWebhook, getPagarmeOrderStatus, requestPagarmeTransfer, getPagarmeRecipientBalance } from './src/backend/services/pagarmeService.js';

process.stdout.write(">>>> [SISTEMA] SERVIDOR INICIALIZADO COM SUCESSO <<<<\n");

// const __filename = fileURLToPath(import.meta.url);
// __dirname is not used in this file, but kept for reference if needed
// const __dirname = path.dirname(__filename);

interface PandaFolder {
  id: string;
  name: string;
  title?: string;
  parent_id?: string | null;
  parent_folder_id?: string | null;
  parentId?: string | null;
}

interface PandaVideo {
  id: string;
  video_id?: string;
  title: string;
  name?: string;
  folder_id?: string | null;
  folderId?: string | null;
  video_player_url?: string;
  embed_url?: string;
  length?: number;
}

interface UserAccess {
  type: string;
  targetId: string;
  isActive: boolean;
  id?: string | number;
  diaInicio?: any;
  diaFim?: any;
}

interface StudentProfile {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userCpf: string;
  userAvatar: string;
  enrollmentType?: string;
  accessOrigin?: string;
  expiresAt?: string | null;
  releasedAt?: string | null;
  active?: boolean;
  createdAt?: unknown;
}

const app = express();
const PORT = 3000;

// No Vercel, o middleware da rota /api/index.ts já cuida do roteamento
// mas mantemos as rotas aqui para o dev server

app.get('/api/log-test', (req, res) => {
  console.log(">>>> [TESTE] LOG ENVIADO PARA VERCEL <<<<");
  res.json({ 
    success: true, 
    message: "Logs enviados",
    env: { VERCEL: process.env.VERCEL, NODE_ENV: process.env.NODE_ENV }
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).send('OK');
});

// Middleware para JSON
app.use(express.json());

async function setupVite(app: any) {
  // Vite middleware para desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Note: As rotas /api/generate-material, /api/panda-videos, /api/panda-explorer, /api/webhooks/ticto,
  // /api/webhooks/pagarme, /api/payments/pagarme/create
  // e /api/admin/courses/:courseId/students foram migradas para Vercel Serverless Functions na pasta /api.
  // Elas são mantidas aqui apenas para compatibilidade com o ambiente de desenvolvimento local.

  // Rota de API: /api/generate-material
  app.post('/api/generate-material', async (req, res) => {
    try {
      const { lessonIds, folderTitle } = req.body;

      if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
        return res.status(400).json({ success: false, error: 'IDs das aulas (lessonIds) são obrigatórios.' });
      }

      if (!folderTitle) {
        return res.status(400).json({ success: false, error: 'folderTitle é obrigatório.' });
      }

      const { dbAdmin } = getAdminConfig();
      const pandaVideoIds: string[] = [];
      
      for (const lessonId of lessonIds) {
        try {
          const snapshot = await dbAdmin.collection('course_contents')
            .where('lessonId', '==', lessonId)
            .get();
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.type === 'video' && data.videoPlatform === 'panda' && data.videoUrl) {
              const pandaId = extractPandaId(data.videoUrl);
              if (pandaId && !pandaVideoIds.includes(pandaId)) {
                pandaVideoIds.push(pandaId);
              }
            }
          });
        } catch (err) {
          console.error(`Erro ao buscar conteúdos da aula ${lessonId}:`, err);
        }
      }

      if (pandaVideoIds.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Nenhum vídeo do Panda Video encontrado nas aulas selecionadas.' 
        });
      }

      let fullTranscription = '';
      for (const videoId of pandaVideoIds) {
        try {
          const transcription = await fetchPandaVideoTranscription(videoId);
          fullTranscription += transcription + '\n\n';
        } catch (error) {
          console.error(`Erro ao extrair transcrição do vídeo ${videoId}:`, error);
        }
      }

      if (!fullTranscription.trim()) {
        return res.status(404).json({ 
          success: false, 
          error: 'Não foi possível extrair nenhuma transcrição dos vídeos selecionados.' 
        });
      }

      const generatedText = await generateStudyMaterial(fullTranscription, folderTitle);

      return res.status(200).json({ 
        success: true, 
        markdown: generatedText 
      });

    } catch (error) {
      console.error("Erro na rota de geração de material:", error);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno no servidor." 
      });
    }
  });

  // Rota de Listagem de Vídeos do Panda com Busca
  app.get('/api/panda-videos', async (req, res) => {
    try {
      const apiKey = process.env.PANDA_API_KEY;
      const search = req.query.search as string;
      
      let url = 'https://api-v2.pandavideo.com.br/videos?limit=1000';
      if (search) {
        url += `&title=${encodeURIComponent(search)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na API do Panda: ${response.status}`);
      }

      const data = await response.json();
      const videos = data.videos || data || [];
      
      // Retorna ID, Título e URL de Embed se disponível
      const cleanVideos = Array.isArray(videos) ? videos.map((v: PandaVideo) => ({
        id: v.id,
        video_id: v.video_id || v.id,
        panda_id: v.video_id || v.id,
        external_id: (v as any).external_id || null,
        playback_id: (v as any).playback_id || null,
        title: v.title || v.name || 'Sem título',
        video_player_url: v.video_player_url || v.embed_url || null,
        length: v.length || 0,
        folder_id: v.folder_id || v.folderId || null
      })) : [];

      return res.status(200).json({ success: true, videos: cleanVideos });
    } catch (error) {
      console.error("Erro ao listar vídeos do Panda:", error);
      return res.status(500).json({ success: false, error: "Falha ao carregar vídeos do Panda." });
    }
  });

  // Rota de Detalhes de um Vídeo do Panda
  app.get('/api/panda-video-details', async (req, res) => {
    try {
      const apiKey = process.env.PANDA_API_KEY;
      const videoId = req.query.id as string;

      if (!videoId) {
        return res.status(400).json({ success: false, error: "ID do vídeo é obrigatório." });
      }

      const url = `https://api-v2.pandavideo.com.br/videos/${videoId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na API do Panda: ${response.status}`);
      }

      const video = await response.json();
      return res.status(200).json({ success: true, video });
    } catch (error) {
      console.error("Erro ao buscar detalhes do vídeo do Panda:", error);
      return res.status(500).json({ success: false, error: "Falha ao carregar detalhes do vídeo do Panda." });
    }
  });

  // Rota de Alunos do Curso (Admin)
  app.get('/api/admin/courses/:courseId/students', async (req, res) => {
    try {
      const { courseId } = req.params;
      const { dbAdmin } = getAdminConfig();

      // 1. Busca Matrículas Diretas (Coleção course_enrollments)
      const directEnrollmentsSnap = await dbAdmin.collection('course_enrollments')
        .where('courseId', '==', courseId)
        .get();
      
      const directEnrollments = directEnrollmentsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 2. Busca Alunos para verificar acesso via Combo (Coleção users -> array access)
      const studentsSnap = await dbAdmin.collection('users')
        .where('role', '==', 'student')
        .get();

      const studentMap = new Map<string, StudentProfile>();

      // Parte A: Processar alunos que ganharam acesso via Combo/Produto
      studentsSnap.docs.forEach(doc => {
        const userData = doc.data();
        const accessArray: UserAccess[] = userData.access || [];
        
        const courseAccess = accessArray.find((acc: UserAccess) => 
          acc.type === 'course' && 
          acc.targetId === courseId && 
          acc.isActive === true
        );

        if (courseAccess) {
          studentMap.set(doc.id, {
            id: doc.id,
            userId: doc.id,
            userName: userData.name || userData.displayName || 'Sem Nome',
            userEmail: userData.email || '',
            userPhone: userData.phone || userData.whatsapp || userData.contact || '',
            userCpf: userData.cpf || '',
            userAvatar: userData.photoURL || '',
            enrollmentType: (courseAccess.id && String(courseAccess.id).startsWith('mig_')) ? 'MIGRACAO' : 'REGULAR',
            accessOrigin: (courseAccess.id && String(courseAccess.id).startsWith('mig_')) ? 'MIGRATION' : 'COMBO',
            expiresAt: courseAccess.diaFim ? (
              (courseAccess.diaFim as any)?.toDate ? (courseAccess.diaFim as any).toDate().toISOString() : 
              String(courseAccess.diaFim)
            ) : null,
            releasedAt: courseAccess.diaInicio ? (
              (courseAccess.diaInicio as any)?.toDate ? (courseAccess.diaInicio as any).toDate().toISOString() : 
              String(courseAccess.diaInicio)
            ) : ((userData.createdAt as any)?.toDate ? (userData.createdAt as any).toDate().toISOString() : String(userData.createdAt || '')),
            active: courseAccess.isActive !== false
          });

          // Adicionar aliases para compatibilidade com o frontend
          (studentMap.get(doc.id) as any).diaInicio = (studentMap.get(doc.id) as any).releasedAt;
          (studentMap.get(doc.id) as any).diaFim = (studentMap.get(doc.id) as any).expiresAt;
        }
      });

      // Parte B: Processar Matrículas Diretas
      for (const enrollment of directEnrollments) {
        const userId = (enrollment as { userId?: string }).userId;
        if (!userId) continue;

        let userProfile = studentMap.get(userId);
        
        if (!userProfile) {
          const userDoc = studentsSnap.docs.find(d => d.id === userId);
          if (userDoc) {
            const userData = userDoc.data();
            userProfile = { 
              id: userDoc.id,
              userId: userDoc.id,
              userName: userData.name || userData.displayName || 'Sem Nome',
              userEmail: userData.email || '',
              userPhone: userData.phone || userData.whatsapp || userData.contact || '',
              userCpf: userData.cpf || '',
              userAvatar: userData.photoURL || '',
              createdAt: userData.createdAt
            };
          } else {
            const docRef = await dbAdmin.collection('users').doc(userId).get();
            if (docRef.exists) {
              const userData = docRef.data() || {};
              userProfile = { 
                id: docRef.id,
                userId: docRef.id,
                userName: userData.name || userData.displayName || 'Sem Nome',
                userEmail: userData.email || '',
                userPhone: userData.phone || userData.whatsapp || userData.contact || '',
                userCpf: userData.cpf || '',
                userAvatar: userData.photoURL || '',
                createdAt: userData.createdAt
              };
            }
          }
        }

        if (userProfile) {
          const enrollmentData = enrollment as any;
          studentMap.set(userId, {
            ...userProfile,
            enrollmentType: enrollmentData.enrollmentType || 'REGULAR',
            accessOrigin: 'DIRECT',
            expiresAt: (enrollmentData.diaFim || enrollmentData.expiresAt) ? (
              (enrollmentData.diaFim as any)?.toDate ? (enrollmentData.diaFim as any).toDate().toISOString() : 
              (enrollmentData.expiresAt as any)?.toDate ? (enrollmentData.expiresAt as any).toDate().toISOString() : 
              String(enrollmentData.diaFim || enrollmentData.expiresAt)
            ) : null,
            releasedAt: (enrollmentData.diaInicio || enrollmentData.releasedAt) ? (
              (enrollmentData.diaInicio as any)?.toDate ? (enrollmentData.diaInicio as any).toDate().toISOString() : 
              (enrollmentData.releasedAt as any)?.toDate ? (enrollmentData.releasedAt as any).toDate().toISOString() : 
              String(enrollmentData.diaInicio || enrollmentData.releasedAt)
            ) : (enrollmentData.createdAt ? (enrollmentData.createdAt.toDate ? (enrollmentData.createdAt.toDate() as Date).toISOString() : String(enrollmentData.createdAt)) : (userProfile.createdAt && (userProfile.createdAt as any).toDate ? (userProfile.createdAt as any).toDate().toISOString() : String(userProfile.createdAt || ''))),
            active: enrollmentData.active !== false
          });

          // Adicionar aliases para compatibilidade
          const updated = studentMap.get(userId) as any;
          if (updated) {
            updated.diaInicio = updated.releasedAt;
            updated.diaFim = updated.expiresAt;
          }
        }
      }

      const aggregatedStudents = Array.from(studentMap.values());
      return res.status(200).json({ success: true, students: aggregatedStudents });
    } catch (error) {
      console.error("Erro ao buscar alunos do curso:", error);
      return res.status(500).json({ success: false, error: "Erro ao buscar alunos." });
    }
  });

  // Rota de Coprodutores (Admin)
  app.get('/api/admin/coproducers', async (req, res) => {
    try {
      const { dbAdmin } = getAdminConfig();
      const snapshot = await dbAdmin.collection('coproducers').orderBy('name', 'asc').get();
      const coproducers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      return res.status(200).json({ success: true, coproducers });
    } catch (error) {
      console.error("Erro ao listar coprodutores:", error);
      return res.status(500).json({ success: false, error: "Erro ao listar coprodutores." });
    }
  });

  app.post('/api/admin/coproducers', async (req, res) => {
    try {
      const { dbAdmin, authAdmin } = getAdminConfig();
      const { name, username, password, document, pagarmeRecipientId } = req.body;
      const now = new Date().toISOString();

      if (!username) {
          return res.status(400).json({ success: false, error: "Usuário é obrigatório." });
      }

      const domain = "@insanus.com.br";
      const email = `${username.toLowerCase().trim()}${domain}`;
      
      // 1. Criar usuário no Firebase Auth (se for novo)
      let uid;
      try {
        const userRecord = await authAdmin.createUser({
          email,
          password,
          displayName: name,
        });
        uid = userRecord.uid;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          const existingUser = await authAdmin.getUserByEmail(email);
          uid = existingUser.uid;
        } else {
          throw authError;
        }
      }

      // 2. Criar perfil na coleção 'users' com a role correta
      await dbAdmin.collection('users').doc(uid).set({
        uid,
        name,
        email,
        username: username.toLowerCase().trim(),
        role: 'coprodutor',
        pagarmeRecipientId: pagarmeRecipientId || null,
        document: document || null,
        status: 'active',
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      // 3. Adicionar à coleção 'coproducers' para compatibilidade com buscas existentes
      await dbAdmin.collection('coproducers').doc(uid).set({
        id: uid,
        name,
        username: username.toLowerCase().trim(),
        email,
        document,
        pagarmeRecipientId,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });

      return res.status(201).json({ success: true, id: uid });
    } catch (error: any) {
      console.error("Erro ao criar coprodutor:", error);
      return res.status(500).json({ success: false, error: error.message || "Erro ao criar coprodutor." });
    }
  });

  app.put('/api/admin/coproducers/:id', async (req, res) => {
    try {
      const { dbAdmin, authAdmin } = getAdminConfig();
      const { id } = req.params;
      const { name, username, password, document, pagarmeRecipientId, isActive } = req.body;
      
      const domain = "@insanus.com.br";
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      if (name) updateData.name = name;
      if (username) {
        updateData.username = username.toLowerCase().trim();
        updateData.email = `${updateData.username}${domain}`;
      }
      if (document) updateData.document = document;
      if (pagarmeRecipientId !== undefined) updateData.pagarmeRecipientId = pagarmeRecipientId;
      if (isActive !== undefined) updateData.isActive = isActive;

      // Update Auth if password or username provided
      if (username || password) {
        const docSnap = await dbAdmin.collection('coproducers').doc(id).get();
        const currentData = docSnap.data();
        const usernameToUse = username || currentData?.username;
        
        if (usernameToUse) {
          const emailToUse = `${usernameToUse.toLowerCase().trim()}${domain}`;

          try {
            const authUpdate: any = {};
            if (password) authUpdate.password = password;
            if (username) authUpdate.email = emailToUse;
            if (name) authUpdate.displayName = name;
            
            await authAdmin.updateUser(id, authUpdate);
          } catch (authError: any) {
            if (authError.code === 'auth/user-not-found') {
              // Creating Auth retroactively
              if (password) {
                await authAdmin.createUser({
                  uid: id,
                  email: emailToUse,
                  password: password,
                  displayName: name || currentData?.name || 'Coprodutor'
                });
              }
            } else {
              throw authError;
            }
          }
        }
      }
      
      await dbAdmin.collection('coproducers').doc(id).update(updateData);
      
      // Sync with users collection
      await dbAdmin.collection('users').doc(id).set({
          ...updateData,
          uid: id,
          role: 'coprodutor'
      }, { merge: true });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Erro ao atualizar coprodutor:", error);
      return res.status(500).json({ success: false, error: error.message || "Erro ao atualizar coprodutor." });
    }
  });

  app.delete('/api/admin/coproducers/:id', async (req, res) => {
    try {
      const { dbAdmin } = getAdminConfig();
      const { id } = req.params;
      await dbAdmin.collection('coproducers').doc(id).delete();
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir coprodutor:", error);
      return res.status(500).json({ success: false, error: "Erro ao excluir coprodutor." });
    }
  });

  // Rota de Explorer do Panda (Pastas e Vídeos Hierárquicos)
  app.get('/api/panda-explorer', async (req, res) => {
    try {
      const apiKey = process.env.PANDA_API_KEY;
      const folderId = req.query.folderId as string | undefined;

      // URLs para pastas e vídeos
      // Buscamos todas as pastas para filtrar em memória (hierarquia cega)
      // Para vídeos, buscamos com limite alto para garantir que pegamos os da pasta ou da raiz
      const foldersUrl = 'https://api-v2.pandavideo.com.br/folders';
      let videosUrl = 'https://api-v2.pandavideo.com.br/videos?limit=1000';

      // Se tivermos um folderId, podemos tentar otimizar a busca de vídeos na API, 
      // mas manteremos o filtro em memória para garantir a hierarquia correta
      if (folderId && folderId !== 'root' && folderId !== 'null') {
        videosUrl += `&folder_id=${folderId}`;
      }

      const headers = {
        'Authorization': apiKey,
        'Accept': 'application/json'
      };

      // Requisições paralelas
      const [foldersRes, videosRes] = await Promise.all([
        fetch(foldersUrl, { method: 'GET', headers }),
        fetch(videosUrl, { method: 'GET', headers })
      ]);

      if (!foldersRes.ok || !videosRes.ok) {
        throw new Error(`Erro na API do Panda: F:${foldersRes.status} V:${videosRes.status}`);
      }

      const foldersData = await foldersRes.json();
      const videosData = await videosRes.json();

      const foldersArray: PandaFolder[] = foldersData.folders || (Array.isArray(foldersData) ? foldersData : []);
      const videosArray: PandaVideo[] = videosData.videos || (Array.isArray(videosData) ? videosData : []);

      const targetFolderId = req.query.folderId as string | undefined;
      const isRoot = !targetFolderId || targetFolderId === 'root' || targetFolderId === 'null' || targetFolderId === '';

      // Filtro Rigoroso de Hierarquia para Pastas com checagem defensiva de propriedades
      const strictFolders = foldersArray.filter((folder: PandaFolder) => {
        // O Panda pode usar diferentes nomenclaturas. Capturamos todas:
        const parentId = folder.parent_folder_id || folder.parent_id || folder.parentId || null;

        if (isRoot) {
          // Estamos na RAIZ. Só queremos pastas "órfãs" (sem pai)
          return !parentId || parentId === 'null' || parentId === '';
        } else {
          // Estamos dentro de uma pasta. Só queremos as filhas dela
          return String(parentId) === String(targetFolderId);
        }
      });

      // Ordenação alfabética das pastas
      strictFolders.sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || ''));

      const folders = strictFolders.map((f) => ({
        id: f.id,
        name: f.name || f.title || 'Pasta sem nome'
      }));

      // Filtro Rigoroso de Hierarquia para Vídeos
      const strictVideos = videosArray.filter((video: PandaVideo) => {
        const videoFolderId = video.folder_id || video.folderId || null;
        if (isRoot) {
          // Se estamos na RAIZ, só queremos vídeos que NÃO estejam em nenhuma pasta
          return !videoFolderId || videoFolderId === 'null' || videoFolderId === '';
        } else {
          // Se estamos dentro de uma pasta, só queremos os vídeos dela
          return String(videoFolderId) === String(targetFolderId);
        }
      });

      // Ordenação alfabética dos vídeos
      strictVideos.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));

      const videos = strictVideos.map((v: PandaVideo) => ({
        id: v.id,
        video_id: v.video_id || v.id,
        panda_id: v.video_id || v.id,
        external_id: (v as any).external_id || null,
        playback_id: (v as any).playback_id || null,
        title: v.title || v.name || 'Sem título',
        video_player_url: v.video_player_url || v.embed_url || null,
        length: v.length || 0,
        folder_id: v.folder_id || v.folderId || null
      }));

      return res.status(200).json({ success: true, folders, videos });
    } catch (error) {
      console.error("Erro no Explorer do Panda:", error);
      return res.status(500).json({ success: false, error: "Falha ao navegar no Panda Video." });
    }
  });

  // Rota de Webhook: /api/webhooks/ticto
  app.post('/api/webhooks/ticto', async (req, res) => {
    try {
      const payload = req.body || {};
      const incomingStatus = payload?.status;
      const incomingProductId = payload?.item?.product_id;
      const incomingToken = payload?.token;

      if (incomingStatus === 'waiting_payment' || incomingProductId === 1 || incomingProductId === '1') {
        return res.status(200).json({ received: true, message: "Teste Ticto Aprovado" });
      }

      const tictoToken = "Zbi2TLCWBPbYJU1Xz14JF7gt8LGm8LQ0tNfMzGcu0US35mR56ye4PFU44We9c5eHcYU6wDzNxNOkx13UDWsVd7FHzI1brmjRrt0i";
      if (incomingToken !== tictoToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { status, customer, item } = payload;
      console.log(`Webhook de Venda Recebido - Status: ${status} | Email: ${customer?.email} | Produto ID: ${item?.product_id}`);

      if (status === 'approved' || status === 'paid' || status === 'authorized') {
        await provisionExternalPurchase(customer, String(item.product_id));
      } else if (['refunded', 'chargeback', 'canceled', 'overdue'].includes(status)) {
        await revokePurchase(customer?.email, String(item.product_id));
      } else {
        console.log(`Status '${status}' ignorado. Nenhuma ação de provisionamento necessária.`);
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Webhook Error:", error);
      return res.status(200).json({ received: true, error: "Internal Error" });
    }
  });

  // Rota de Criação de Pagamento Pagar.me
  app.post('/api/payments/pagarme/create', async (req, res) => {
    console.log(">>>> [FLUXO] REQUISIÇÃO DE PAGAMENTO RECEBIDA <<<<");
    try {
      const { dbAdmin } = getAdminConfig();
      const body = req.body;
      const productId = body.productId || body.metadata?.courseId;

      let coproducers: any[] = [];
      if (productId) {
        try {
          const coproSnap = await dbAdmin.collection('coproducers')
            .where('courseId', '==', String(productId))
            .where('isActive', '==', true)
            .get();
          
          coproducers = coproSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        } catch (err) {
          console.error('[Server] Erro ao buscar coprodutores para split:', err);
        }
      }

      const response = await createPagarmeOrder(body, coproducers);
      
      // Se for PIX, extraímos os dados do QR Code para o frontend
      if (body.payment_method === 'pix' && response.status === 'pending') {
        const charge = response.charges?.[0];
        const lastTransaction = charge?.last_transaction;
        
        if (lastTransaction && lastTransaction.qr_code) {
          return res.status(200).json({ 
            success: true, 
            pix: {
              qr_code: lastTransaction.qr_code,
              qr_code_url: lastTransaction.qr_code_url,
              status: 'pending'
            },
            payment: response 
          });
        }
      }

      return res.status(200).json({ success: true, payment: response });
    } catch (error: any) {
      console.error("❌ Pagarme Route Error:", error);
      
      // Se for uma falha de pagamento (cartão recusado), retornamos a mensagem específica
      if (error.status === 'failed') {
        return res.status(400).json({
          success: false,
          error: "Pagamento Recusado",
          message: error.message || "Pagamento recusado pelo banco. Verifique seus dados ou tente outro cartão.",
          status: 'failed'
        });
      }

      return res.status(400).json({ 
        success: false, 
        error: "Erro no Checkout",
        message: error.message || "Falha na comunicação com o provedor de pagamentos."
      });
    }
  });

  // Rota de consulta de status Pagar.me para Polling do Frontend
  app.get('/api/payments/pagarme/status', async (req, res) => {
    try {
      const orderId = req.query.orderId as string;
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'orderId e obrigatorio' });
      }
      const order = await getPagarmeOrderStatus(orderId);
      return res.status(200).json({ 
        success: true, 
        status: order.status, // 'paid', 'pending', 'canceled', etc.
        order 
      });
    } catch (error) {
      console.error("Erro ao consultar status Pagar.me:", error);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // Rota de consulta de saldo Pagar.me
  app.get('/api/payments/pagarme/balance', async (req, res) => {
    try {
      const recipientId = req.query.recipientId as string;
      if (!recipientId) {
        return res.status(400).json({ success: false, error: 'recipientId é obrigatório' });
      }
      
      // Consultando saldo real na Pagar.me
      const balance = await getPagarmeRecipientBalance(recipientId);
      return res.status(200).json({ success: true, balance });
    } catch (error: any) {
      console.error("Erro ao consultar saldo Pagar.me:", error);
      return res.status(500).json({ success: false, error: error.message || 'Erro interno no servidor' });
    }
  });

  // Rota de solicitação de saque Pagar.me
  app.post('/api/payments/pagarme/request-payout', async (req, res) => {
    try {
      const { recipientId, amount } = req.body;
      
      if (!recipientId || !amount) {
        return res.status(400).json({ success: false, error: 'recipientId e amount são obrigatórios' });
      }

      const transfer = await requestPagarmeTransfer(recipientId, amount);
      return res.status(200).json({ success: true, transfer });
    } catch (error: any) {
      console.error("Erro ao solicitar saque Pagar.me:", error);
      return res.status(500).json({ success: false, error: error.message || 'Erro interno no servidor' });
    }
  });

  // Rota de Webhook Pagar.me
  app.post('/api/webhooks/pagarme', async (req, res) => {
    console.log('✅ [Webhook Pagar.me] Recebido:', req.body.type);
    
    try {
      // No Vercel/Serverless, DEVEMOS esperar o processamento antes de responder,
      // caso contrário o processo é congelado e o fulfillment (e-mail/banco) não termina.
      await handlePagarmeWebhook(req.body);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully' 
      });
    } catch (error) {
      console.error("❌ Erro no Fulfillment do Webhook Pagar.me:", error);
      // Retornamos 200 mesmo em erro para o Pagar.me não ficar tentando infinitamente
      // se for um erro lógico, mas logamos pesado para auditoria.
      return res.status(200).json({ 
        success: false, 
        error: "Fulfillment failed but webhook acknowledged" 
      });
    }
  });

  // Rota de Migração Temporária para Sincronizar Dados de Afiliados (Follow-up) - VERSÃO ROBUSTA
  app.get('/api/admin/migrations/sync-commissions', async (req, res) => {
    try {
      const { dbAdmin } = getAdminConfig();
      // Buscamos todos para garantir que nada ficou para trás
      const snapshot = await dbAdmin.collection('affiliate_commissions').get();
      const docs = snapshot.docs;

      console.log(`[Migration] Iniciando varredura total em ${docs.length} documentos.`);

      let updatedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const doc of docs) {
        const docData = doc.data();
        
        // Se já tem dados válidos, podemos optar por pular para economizar processamento
        if (docData.customerEmail && docData.customerEmail !== 'N/A' && docData.customerName && docData.customerPhone && docData.customerPhone !== 'N/A') {
          skippedCount++;
          continue;
        }

        const orderId = docData.orderId;
        if (!orderId) {
          failedCount++;
          continue;
        }

        console.log(`[Migration] Sincronizando Pedido: ${orderId}...`);
        let customerInfo: any = null;

        // --- FONTE 1: Coleção local 'orders' ---
        try {
          const orderDoc = await dbAdmin.collection('orders').doc(orderId).get();
          if (orderDoc.exists) {
            const data = orderDoc.data();
            customerInfo = data?.customer || data?.payer || data;
          } else {
             const orderQuery = await dbAdmin.collection('orders').where('orderId', '==', orderId).limit(1).get();
             if (!orderQuery.empty) {
               const data = orderQuery.docs[0].data();
               customerInfo = data?.customer || data?.payer || data;
             }
          }
        } catch (e) { /* ignore */ }

        // --- FONTE 2: Pagar.me API ---
        if (!customerInfo) {
          try {
            const orderDetails = await getPagarmeOrderStatus(orderId);
            if (orderDetails && orderDetails.customer) {
              customerInfo = orderDetails.customer;
            }
          } catch (e) { /* ignore */ }
        }

        // --- FONTE 3: Coleção 'users' ---
        if (!customerInfo) {
          try {
            // Tenta buscar usuário que tenha este orderId vinculado (seja em metadata ou no email)
            const userByEmail = await dbAdmin.collection('users').where('email', '==', docData.customerEmail).limit(1).get();
            if (!userByEmail.empty) {
              customerInfo = userByEmail.docs[0].data();
            }
          } catch (e) { /* ignore */ }
        }

        if (customerInfo) {
          const name = customerInfo.name || customerInfo.userName || customerInfo.displayName || 'Cliente';
          const email = customerInfo.email || customerInfo.userEmail || 'N/A';
          
          let phone = customerInfo.phone || customerInfo.userPhone || customerInfo.whatsapp || customerInfo.contact || 'N/A';
          if (customerInfo.phones?.mobile_phone) {
            const mp = customerInfo.phones.mobile_phone;
            phone = `+${mp.country_code}${mp.area_code}${mp.number}`;
          }

          await doc.ref.update({
            customerName: name,
            customerEmail: email,
            customerPhone: phone
          });

          console.log(`[Migration] ✅ Sincronizado: Pedido ${orderId} -> Cliente ${name}`);
          updatedCount++;
        } else {
          console.warn(`[Migration] ❌ Dados nao encontrados para o pedido ${orderId}`);
          failedCount++;
        }
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Migração de follow-up concluída com multi-fonte',
        total: docs.length,
        updated: updatedCount,
        skipped: skippedCount,
        failed: failedCount
      });
    } catch (error) {
      console.error("Erro na migração:", error);
      return res.status(500).json({ success: false, error: "Erro interno na migração." });
    }
  });

// Função auxiliar extractPandaId
function extractPandaId(url: string): string | null {
    try {
      if (!url) return null;
      if (!url.includes('http')) return url.split('?v=')[1] || url.split('/embed/')[1] || url.split('/video/')[1] || url;
      
      const urlObj = new URL(url);
      const v = urlObj.searchParams.get('v');
      if (v) return v;

      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      // Se a URL for do tipo .../embed/ID ou .../video/ID
      if (url.includes('/embed/') || url.includes('/video/')) {
        return pathParts[pathParts.length - 1];
      }
      
      return pathParts[pathParts.length - 1] || url;
    } catch {
      return url;
    }
  }

// Error handler global
app.use((err: any, req: any, res: any, next: any) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`>>>> [ERRO-GLOBAL] ${err.message} <<<<`);
  }
  res.status(500).json({ success: false, error: 'Erro interno no servidor' });
});

async function startServer() {
  try {
    process.stdout.write(">>>> [BOOT] SINAL DE VIDA RECEBIDO <<<<\n");
    process.stdout.write(`>>>> [BOOT] NODE_ENV: ${process.env.NODE_ENV}\n`);
    process.stdout.write(`>>>> [BOOT] Pagarme API Key presente: ${!!(process.env.PAGARME_API_KEY || process.env.PAGARME_SECRET_KEY)}\n`);
    process.stdout.write(`>>>> [BOOT] Frontend URL: ${process.env.FRONTEND_URL || 'NÃO DEFINIDA'}\n`);

    await setupVite(app);

    if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
      app.listen(PORT, '0.0.0.0', () => {
        process.stdout.write(`>>>> [SISTEMA] SERVIDOR RODANDO NA PORTA ${PORT} <<<<\n`);
        console.log(`Server running on http://localhost:${PORT}`);
      });
    } else if (process.env.VERCEL) {
        process.stdout.write(">>>> [SISTEMA] SERVIDOR RODANDO EM MODO VERCEL (SERVERLESS) <<<<\n");
    }
  } catch (error) {
    const errorMsg = `>>>> [FATAL-ERROR] FALHA CRÍTICA NA INICIALIZAÇÃO: ${error instanceof Error ? error.stack : String(error)} <<<<\n`;
    process.stderr.write(errorMsg);
    // Não terminamos o processo para permitir que a Vercel/Ambiente tente reportar o erro
  }
}

// Start the server if we're not being imported as a module (simple check)
if (!process.env.VERCEL) {
  startServer();
}

export default app;
