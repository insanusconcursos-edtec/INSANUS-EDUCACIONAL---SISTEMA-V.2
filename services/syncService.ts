
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { getPlanById } from './planService';
import { getEdict } from './edictService';
import { getDisciplines, getTopics } from './structureService';
import { getMetas } from './metaService';
import { getStudentConfig } from './studentService';
import { generateSchedule } from './scheduleService';

// Interfaces for Published Data
// This is a denormalized "snapshot" of the plan
export interface PublishedPlanData {
  planDetails: any; // Basic plan info (title, image, etc)
  cycles: any[];    // Cycles Array
  edict: any;       // Edict Structure
  structure: {      // Hierarchical Content Tree
    disciplines: {
        id: string;
        name: string;
        order: number;
        folderId?: string | null;
        topics: {
            id: string;
            name: string;
            order: number;
            metas: {
                id: string;
                title: string;
                type: string;
            }[];
        }[];
    }[];
  };
  publishedAt: any;
}

export const checkSyncStatus = async (planId: string): Promise<{ hasPendingChanges: boolean, lastModified?: any, lastSynced?: any }> => {
  const plan = await getPlanById(planId);
  
  if (!plan) throw new Error("Plano não encontrado");

  const lastModified = plan.lastModifiedAt?.toDate ? plan.lastModifiedAt.toDate() : null;
  const lastSynced = plan.lastSyncedAt?.toDate ? plan.lastSyncedAt.toDate() : null;

  // Se nunca foi sincronizado, ou se modificação é mais recente que sincronização
  const hasPendingChanges = !lastSynced || (lastModified && lastModified > lastSynced);

  return {
    hasPendingChanges,
    lastModified,
    lastSynced
  };
};

/**
 * Monta a árvore completa do plano (Disciplina -> Topico -> Meta (Resumo))
 * Isso permite que o app do aluno navegue pela estrutura sem fazer milhares de leituras.
 */
const buildFullPlanTree = async (planId: string) => {
  const disciplines = await getDisciplines(planId);
  const tree = [];

  for (const disc of disciplines) {
    if (!disc.id) continue;
    
    const topics = await getTopics(planId, disc.id);
    const topicsWithMetas = [];

    for (const topic of topics) {
      if (!topic.id) continue;
      
      // Fetch apenas o básico das metas para navegação/linkagem
      const metas = await getMetas(planId, disc.id, topic.id);
      
      topicsWithMetas.push({
        id: topic.id,
        name: topic.name,
        order: topic.order,
        metas: metas.map(m => ({
            id: m.id,
            title: m.title,
            type: m.type
        }))
      });
    }

    tree.push({
        id: disc.id,
        name: disc.name,
        order: disc.order,
        folderId: disc.folderId,
        topics: topicsWithMetas
    });
  }

  return tree;
};

export const publishPlan = async (planId: string): Promise<void> => {
  try {
    console.log(`[SyncService] Iniciando publicação do plano ${planId}...`);

    // 1. Fetch Plan Base Data (Including Cycles)
    const plan = await getPlanById(planId);
    if (!plan) throw new Error("Plano base não encontrado");

    // 2. Fetch Edict Data
    const edict = await getEdict(planId);

    // 3. Build Full Structure Tree (Heavy Operation)
    const structureTree = await buildFullPlanTree(planId);

    // 4. Construct Published Object
    const { createdAt, lastModifiedAt, lastSyncedAt, ...cleanPlanDetails } = plan;

    const publishedData: PublishedPlanData = {
        planDetails: cleanPlanDetails,
        cycles: plan.cycles || [],
        edict: edict,
        structure: {
            disciplines: structureTree
        },
        publishedAt: serverTimestamp()
    };

    // 5. Save to "Published" Collection (Singleton 'current')
    const publishedRef = doc(db, 'plans', planId, 'published', 'current');
    await setDoc(publishedRef, publishedData);

    // 6. Update Parent Plan Sync Status
    const planRef = doc(db, 'plans', planId);
    await updateDoc(planRef, {
        lastSyncedAt: serverTimestamp()
    });

    console.log(`[SyncService] Plano ${planId} publicado com sucesso!`);

  } catch (error) {
    console.error("[SyncService] Erro ao publicar plano:", error);
    throw error;
  }
};

/**
 * CORE LOGIC: Sincroniza o plano do aluno com o plano mestre publicado.
 * 
 * Estratégia:
 * 1. Usa `generateSchedule` que já possui a inteligência de "Soft Replan".
 * 2. O `generateSchedule` preserva eventos passados/completos e reagenda o futuro baseado na NOVA estrutura.
 * 3. Atualiza o timestamp de sincronização do usuário para evitar novos alertas.
 */
export const syncStudentPlan = async (uid: string, planId: string) => {
  try {
    console.log(`[SyncService] Sincronizando aluno ${uid} com plano ${planId}...`);

    // 1. Obter Configurações do Aluno (Rotina, Perfil)
    const config = await getStudentConfig(uid);
    if (!config) throw new Error("Configuração do aluno não encontrada.");

    // 2. Regenerar Cronograma (Isso aplica as mudanças estruturais mantendo o progresso)
    // O `generateSchedule` busca a estrutura atualizada do banco e faz o merge.
    await generateSchedule(uid, planId, config.studyProfile, config.routine);

    // 3. Obter Timestamp do Plano Mestre
    const plan = await getPlanById(planId);
    if (!plan || !plan.lastSyncedAt) throw new Error("Plano mestre inválido ou não publicado.");

    // 4. Marcar Usuário como Sincronizado
    const userRef = doc(db, 'users', uid);
    
    // Atualiza campo específico nas stats do plano
    await updateDoc(userRef, {
        [`planStats.${planId}.lastSyncedAt`]: plan.lastSyncedAt
    });

    console.log(`[SyncService] Sincronização concluída para ${uid}.`);

  } catch (error) {
    console.error("[SyncService] Falha na sincronização do aluno:", error);
    throw error;
  }
};
