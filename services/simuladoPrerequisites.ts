import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Plan } from './planService';
import { buildLogicalSubjects } from './scheduleService';

export const getSimuladoPrerequisites = async (planId: string): Promise<Record<string, string[]>> => {
  const planRef = doc(db, 'plans', planId);
  const planSnap = await getDoc(planRef);
  if (!planSnap.exists()) return {};
  const planData = planSnap.data() as Plan;

  const sortedCycles = (planData.cycles || []).sort((a, b) => (a.order || 0) - (b.order || 0));

  const disciplinesQuery = query(collection(db, 'plans', planId, 'disciplines'), orderBy('order'));
  const disciplinesSnap = await getDocs(disciplinesQuery);
  const sortedDisciplines = disciplinesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const sortedTopics: any[] = [];
  const sortedTasks: any[] = [];

  for (const disc of sortedDisciplines) {
    const topicsQuery = query(collection(db, 'plans', planId, 'disciplines', disc.id, 'topics'), orderBy('order'));
    const topicsSnap = await getDocs(topicsQuery);
    
    for (const topicDoc of topicsSnap.docs) {
      const topicData = { id: topicDoc.id, subjectId: disc.id, ...topicDoc.data() };
      sortedTopics.push(topicData);
      
      const metasQuery = query(collection(db, 'plans', planId, 'disciplines', disc.id, 'topics', topicDoc.id, 'metas'), orderBy('order'));
      const metasSnap = await getDocs(metasQuery);
      
      for (const metaDoc of metasSnap.docs) {
        sortedTasks.push({ 
          id: metaDoc.id, 
          topicId: topicDoc.id, 
          subjectId: disc.id, 
          ...metaDoc.data() 
        });
      }
    }
  }

  const logicalSubjectsBySubj = buildLogicalSubjects(sortedTopics, sortedTasks);
  const isRotative = planData.cycleSystem === 'rotative';

  const expandCycleItems = (items: any[]) => {
    const expanded: any[] = [];
    for (const item of items) {
      if (item.type === 'discipline') {
        expanded.push({ type: 'discipline', id: item.referenceId, topicsPerTurn: item.topicsPerTurn });
      } else if (item.type === 'folder') {
        const folderDisciplines = sortedDisciplines.filter(d => (d as any).folderId === item.referenceId);
        folderDisciplines.sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0));
        folderDisciplines.forEach(d => {
          expanded.push({ type: 'discipline', id: d.id, topicsPerTurn: item.topicsPerTurn });
        });
      } else if (item.type === 'simulado') {
        expanded.push({ type: 'simulado', id: item.id, referenceId: item.referenceId });
      }
    }
    return expanded;
  };

  const prerequisites: Record<string, string[]> = {};
  const currentPrereqs: string[] = [];
  const progress: Record<string, number> = {}; 

  if (isRotative) {
    let hasMoreTopicsGlobal = true;
    while (hasMoreTopicsGlobal) {
      hasMoreTopicsGlobal = false;
      let topicsAddedInThisGlobalRound = false;

      for (const cycle of sortedCycles) {
        const expandedItems = expandCycleItems(cycle.items || []);
        
        for (const item of expandedItems) {
          if (item.type === 'simulado') {
             if (item.id && !prerequisites[item.id]) {
                 prerequisites[item.id] = [...currentPrereqs];
             }
          } else {
             const subjectId = item.id;
             const topicsPerRound = item.topicsPerTurn || 1;
             if (progress[subjectId] === undefined) progress[subjectId] = 0;

             const groups = logicalSubjectsBySubj[subjectId] || [];
             const currentIdx = progress[subjectId];

             if (currentIdx < groups.length) {
               hasMoreTopicsGlobal = true;
               topicsAddedInThisGlobalRound = true;

               const groupsToProcess = groups.slice(currentIdx, currentIdx + topicsPerRound);
               groupsToProcess.forEach(g => {
                   g.tasks.forEach(t => {
                       if (t.id) currentPrereqs.push(t.id);
                   });
               });
               
               progress[subjectId] += topicsPerRound;
             }
          }
        }
      }
      if (!topicsAddedInThisGlobalRound) break;
    }
  } else {
    for (const cycle of sortedCycles) {
      const expandedItems = expandCycleItems(cycle.items || []);
      const simuladosAdded = new Set<string>();

      let hasMoreTopicsCycle = true;
      while (hasMoreTopicsCycle) {
        hasMoreTopicsCycle = false;
        let topicsAddedInThisRound = false;

        for (const item of expandedItems) {
           if (item.type === 'simulado') {
              if (item.id && !simuladosAdded.has(item.id)) {
                  prerequisites[item.id] = [...currentPrereqs];
                  simuladosAdded.add(item.id);
              }
           } else {
              const subjectId = item.id;
              const topicsPerRound = item.topicsPerTurn || 1;
              if (progress[subjectId] === undefined) progress[subjectId] = 0;

              const groups = logicalSubjectsBySubj[subjectId] || [];
              const currentIdx = progress[subjectId];

              if (currentIdx < groups.length) {
                hasMoreTopicsCycle = true;
                topicsAddedInThisRound = true;

                const groupsToProcess = groups.slice(currentIdx, currentIdx + topicsPerRound);
                groupsToProcess.forEach(g => {
                    g.tasks.forEach(t => {
                        if (t.id) currentPrereqs.push(t.id);
                    });
                });
                
                progress[subjectId] += topicsPerRound;
              }
           }
        }
        if (!topicsAddedInThisRound) break;
      }
    }
  }

  return prerequisites;
};
