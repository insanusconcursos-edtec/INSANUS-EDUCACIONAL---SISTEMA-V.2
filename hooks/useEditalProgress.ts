
import { useMemo } from 'react';
import { EdictStructure } from '../services/edictService';

interface EditalProgressStats {
  globalProgress: number;
  disciplineStats: Record<string, number>;
  totalGoals: number;
  completedGoals: number;
}

export const useEditalProgress = (
  structure: EdictStructure | null, 
  completedMetaIds: Set<string>
): EditalProgressStats => {
  return useMemo(() => {
    // 1. Proteção contra dados vazios ou carregando
    if (!structure) {
      return { 
        globalProgress: 0, 
        disciplineStats: {}, 
        totalGoals: 0, 
        completedGoals: 0 
      };
    }

    let globalTotal = 0;
    let globalCompleted = 0;
    const disciplineStats: Record<string, number> = {};

    // 2. Iteração sobre as Disciplinas
    structure.disciplines.forEach(discipline => {
      let discTotal = 0;
      let discCompleted = 0;

      // Função auxiliar para contar metas vinculadas em Tópicos e Subtópicos
      const countGoals = (linkedGoals: any) => {
        if (!linkedGoals) return;
        
        // Itera sobre os tipos de meta (lesson, material, etc.)
        Object.values(linkedGoals).forEach((ids: any) => {
          if (Array.isArray(ids)) {
            discTotal += ids.length;
            ids.forEach(id => {
              const normalizedId = String(id).trim();
              if (completedMetaIds.has(normalizedId)) {
                discCompleted++;
              }
            });
          }
        });
      };

      // Varre Tópicos
      discipline.topics.forEach(topic => {
        countGoals(topic.linkedGoals);
        // Varre Subtópicos
        topic.subtopics.forEach(subtopic => {
          countGoals(subtopic.linkedGoals);
        });
      });

      // Calcula % da disciplina (evita divisão por zero)
      const percentage = discTotal === 0 ? 0 : Math.round((discCompleted / discTotal) * 100);
      disciplineStats[discipline.id] = percentage;

      // Soma ao total global
      globalTotal += discTotal;
      globalCompleted += discCompleted;
    });

    // 3. Cálculo Global Final
    const globalProgress = globalTotal === 0 ? 0 : Math.round((globalCompleted / globalTotal) * 100);

    return {
      globalProgress,
      disciplineStats,
      totalGoals: globalTotal,
      completedGoals: globalCompleted
    };
  }, [structure, completedMetaIds]); // Recalcula automaticamente se structure ou completedMetaIds mudar
};
