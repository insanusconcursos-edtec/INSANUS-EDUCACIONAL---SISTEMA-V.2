
import { useMemo } from 'react';
import { EdictStructure } from '../services/edictService';

interface EditalProgressStats {
  globalProgress: number;
  disciplineStats: Record<string, number>;
  groupStats: Record<string, number>;
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
        groupStats: {},
        totalGoals: 0, 
        completedGoals: 0 
      };
    }

    let globalTotal = 0;
    let globalCompleted = 0;
    const disciplineStats: Record<string, number> = {};
    const groupStats: Record<string, number> = {};

    // 2. Iteração sobre as Disciplinas
    structure.disciplines.forEach(discipline => {
      let discTotal = 0;
      let discCompleted = 0;

      const groupTotals: Record<string, number> = {};
      const groupCompletions: Record<string, number> = {};

      if (discipline.topicGroups) {
        discipline.topicGroups.forEach(group => {
           groupTotals[group.id] = 0;
           groupCompletions[group.id] = 0;
        });
      }

      // Função auxiliar para contar metas vinculadas em Tópicos e Subtópicos
      const countGoals = (linkedGoals: any, groupId?: string | null) => {
        if (!linkedGoals) return;
        
        // Itera sobre os tipos de meta (lesson, material, etc.)
        Object.values(linkedGoals).forEach((ids: any) => {
          if (Array.isArray(ids)) {
            discTotal += ids.length;
            if (groupId && groupTotals[groupId] !== undefined) {
              groupTotals[groupId] += ids.length;
            }
            
            ids.forEach(id => {
              const normalizedId = String(id).trim();
              if (completedMetaIds.has(normalizedId)) {
                discCompleted++;
                if (groupId && groupCompletions[groupId] !== undefined) {
                  groupCompletions[groupId]++;
                }
              }
            });
          }
        });
      };

      // Varre Tópicos
      discipline.topics.forEach(topic => {
        countGoals(topic.linkedGoals, topic.groupId);
        // Varre Subtópicos
        topic.subtopics.forEach(subtopic => {
          // Subtópicos pertencem ao mesmo grupo do seu tópico pai
          countGoals(subtopic.linkedGoals, topic.groupId);
        });
      });

      // Calcula % da disciplina (evita divisão por zero)
      const percentage = discTotal === 0 ? 0 : Math.round((discCompleted / discTotal) * 100);
      disciplineStats[discipline.id] = percentage;

      // Calcula % dos grupos
      if (discipline.topicGroups) {
        discipline.topicGroups.forEach(group => {
           const gTotal = groupTotals[group.id] || 0;
           const gCompleted = groupCompletions[group.id] || 0;
           groupStats[group.id] = gTotal === 0 ? 0 : Math.round((gCompleted / gTotal) * 100);
        });
      }

      // Soma ao total global
      globalTotal += discTotal;
      globalCompleted += discCompleted;
    });

    // 3. Cálculo Global Final
    const globalProgress = globalTotal === 0 ? 0 : Math.round((globalCompleted / globalTotal) * 100);

    return {
      globalProgress,
      disciplineStats,
      groupStats,
      totalGoals: globalTotal,
      completedGoals: globalCompleted
    };
  }, [structure, completedMetaIds]); // Recalcula automaticamente se structure ou completedMetaIds mudar
};
