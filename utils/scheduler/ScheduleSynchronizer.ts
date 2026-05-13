import { ClassScheduleEvent } from '../../types/schedule';
import { Topic, Module } from '../../types/curriculum';

export const sanitizeSchedule = (
  events: ClassScheduleEvent[], 
  activeTopics: Topic[], 
  activeModules: Module[]
): ClassScheduleEvent[] => {
  // Cria conjuntos (Sets) com os IDs ativos para busca rápida (O(1))
  const activeTopicIds = new Set(activeTopics.map(t => t.id));
  const activeModuleIds = new Set(
    activeModules
      .filter(m => !m.isOnline)
      .map(m => m.id)
  );

  // Retorna apenas os eventos que pertencem a tópicos e módulos que AINDA existem
  return events.filter(event => {
    // Se o evento não for uma aula padrão (ex: feriado, lacuna), mantenha-o.
    if (!event.topicId || !event.moduleId) return true; 

    const topicExists = activeTopicIds.has(event.topicId);
    const moduleExists = activeModuleIds.has(event.moduleId);

    return topicExists && moduleExists;
  });
};
