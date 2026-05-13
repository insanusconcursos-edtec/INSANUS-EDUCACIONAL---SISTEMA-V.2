
import { 
  writeBatch, 
  doc, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp,
  serverTimestamp,
  documentId
} from 'firebase/firestore';
import { db } from './firebase';

const cleanObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(cleanObject);
  }

  // Se não for um objeto simples (ex: Timestamp, FieldValue, Date), retorna como está
  if (Object.prototype.toString.call(obj) !== '[object Object]') {
    return obj;
  }
  
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      newObj[key] = cleanObject(obj[key]);
    }
  });
  return newObj;
};

import { rescheduleOverdueTasks, generateSchedule } from './scheduleService';
import { getStudentConfig, checkAndUnlockSimulados } from './studentService';

export const editalProgressService = {

  /**
   * Marca um tópico ou lista de metas como concluído MANUALMENTE.
   * 1. Salva em 'edital_progress' para persistência visual no edital.
   * 2. REMOVE da agenda futura (schedules) se existir (liberando espaço).
   * 3. ACIONA REORGANIZAÇÃO (EMPUXO) para preencher o vazio com metas futuras.
   */
  async completeTopicManually(userId: string, planId: string, metaIds: string[]) {
    const batch = writeBatch(db);
    const timestamp = serverTimestamp();
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. ATUALIZAR PROGRESSO (Persistência do Check Verde no Edital)
    metaIds.forEach(id => {
        const progressRef = doc(db, 'users', userId, 'plans', planId, 'edital_progress', id);
        batch.set(progressRef, cleanObject({ 
            metaId: id,
            completed: true, 
            status: 'completed',
            completedAt: timestamp,
            manuallyCompleted: true 
        }), { merge: true });
    });

    await batch.commit();

    // 2.1 WIPE TOTAL (Limpeza Cega do Futuro)
    // DIRETRIZ ESTRITA: Apaga documentos inteiros para garantir terreno limpo
    try {
        const futureScheduleRef = collection(db, 'users', userId, 'schedules');
        const futureQuery = query(futureScheduleRef, where(documentId(), '>=', todayStr));
        const futureSnap = await getDocs(futureQuery);
        
        if (!futureSnap.empty) {
            const wipeBatch = writeBatch(db);
            futureSnap.docs.forEach(d => wipeBatch.delete(d.ref));
            await wipeBatch.commit();
            console.log(`[EditalProgress] Wipe concluído: ${futureSnap.size} dias removidos.`);
        }
    } catch (wipeError) {
        console.error("[EditalProgress] Erro durante o Wipe:", wipeError);
    }

    // 3. TRIGGER SIMULADO UNLOCK CHECK
    // Since we completed topics manually, we might have met the requirements for a simulado.
    await checkAndUnlockSimulados(userId, planId);

    // 4. REORGANIZAÇÃO AUTOMÁTICA (EMPUXO)
    // Invocamos a regeneração passando os IDs recém-concluídos para blindagem contra latência
    if (metaIds.length > 0) {
        try {
            console.log("[EditalProgress] Detectado conclusão manual. Regenerando agenda com blindagem...");
            const config = await getStudentConfig(userId);
            if (config && config.routine && config.studyProfile) {
                // DIRETRIZ ESTRITA: Invocando generateSchedule com ignoredTaskIds
                await generateSchedule(userId, planId, config.studyProfile, config.routine, metaIds);
            } else if (config && config.routine) {
                // Fallback se não houver profile
                await rescheduleOverdueTasks(userId, planId, config.routine);
            }
        } catch (error) {
            console.error("[EditalProgress] Erro ao reorganizar agenda após conclusão manual:", error);
        }
    }

    return true;
  },

  /**
   * Utilitário para limpar registros "lixo" criados anteriormente por bugs.
   * Remove itens da agenda que tenham título "Conclusão Manual" ou similar.
   */
  async cleanupBadManualEntries(userId: string, planId: string) {
      try {
        const scheduleRef = collection(db, 'users', userId, 'schedules');
        const q = query(scheduleRef, where('planId', '==', planId));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        let count = 0;

        snapshot.docs.forEach(docSnap => {
            const items = docSnap.data().items || [];
            const cleanItems = items.filter((item: any) => {
                const isGarbage = item.title === 'Conclusão Manual' || (item.topicName === 'Manual' && item.disciplineName === 'Manual');
                return !isGarbage;
            });

            if (cleanItems.length !== items.length) {
                if (cleanItems.length === 0) {
                    batch.delete(docSnap.ref);
                } else {
                    batch.update(docSnap.ref, cleanObject({ items: cleanItems }));
                }
                count++;
            }
        });
        
        if (count > 0) await batch.commit();
        console.log(`Limpeza concluída. ${count} documentos afetados.`);
      } catch (e) {
          console.error("Erro na limpeza:", e);
      }
  },

  /**
   * Reseta todo o progresso do edital (Checks manuais e automáticos persistidos visualmente).
   * Apaga a subcoleção 'edital_progress' do usuário para este plano.
   */
  async resetEditalProgress(userId: string, planId: string) {
    try {
        const progressRef = collection(db, 'users', userId, 'plans', planId, 'edital_progress');
        const snapshot = await getDocs(progressRef);
        
        if (snapshot.empty) return;

        const batchSize = 450;
        let batch = writeBatch(db);
        let count = 0;

        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            count++;
            if (count >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
        }
        console.log(`Progresso do edital resetado. ${snapshot.size} itens removidos.`);
    } catch (error) {
        console.error("Erro ao resetar progresso do edital:", error);
        throw error;
    }
  }
};
