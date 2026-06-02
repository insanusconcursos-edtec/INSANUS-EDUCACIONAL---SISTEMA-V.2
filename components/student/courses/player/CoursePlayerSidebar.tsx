import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Layers, Clock, Video } from 'lucide-react';
import { CourseLesson, CourseSubModule, CourseGroup } from '../../../../types/course';

interface CoursePlayerSidebarProps {
  structure: {
    groups: CourseGroup[];
    subModules: CourseSubModule[];
    lessons: CourseLesson[];
  };
  activeLessonId: string | null;
  onSelectLesson: (lesson: CourseLesson) => void;
  moduleTitle: string;
  completedLessons: string[]; // Recebe a lista de IDs
}

export function CoursePlayerSidebar({ 
  structure, 
  activeLessonId, 
  onSelectLesson, 
  moduleTitle, 
  completedLessons = []
}: CoursePlayerSidebarProps) {
  // Helper para filtrar aulas
  const getLessonsInFolder = (folderId: string) => structure.lessons
    .filter(l => l.subModuleId === folderId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // --- CÁLCULO MÓDULO (Local) ---
  const moduleTotal = structure.lessons.length;
  const moduleCompleted = structure.lessons.filter(l => completedLessons.includes(l.id)).length;
  const modulePercentage = moduleTotal > 0 ? Math.round((moduleCompleted / moduleTotal) * 100) : 0;

  // --- ESTRUTURAÇÃO DA HIERARQUIA ---
  const navigationGroups = useMemo(() => {
    // 1. Mapeia os grupos
    const grps = structure.groups.sort((a, b) => (a.order || 0) - (b.order || 0)).map(group => {
      const groupFolders = structure.subModules.filter(s => s.groupId === group.id && !s.parentId);
      const groupLessons = structure.lessons.filter(l => !l.subModuleId && l.groupId === group.id);
      
      return {
        id: group.id,
        title: group.title,
        items: [
          ...groupFolders.map(f => ({ type: 'folder' as const, id: f.id, data: f, order: f.order })),
          ...groupLessons.map(l => ({ type: 'lesson' as const, id: l.id, data: l, order: l.order }))
        ].sort((a, b) => (a.order || 0) - (b.order || 0))
      };
    });

    // 2. Filtra órfãos
    const orphanFolders = structure.subModules.filter(s => !s.groupId && !s.parentId);
    const orphanLessons = structure.lessons.filter(l => !l.subModuleId && !l.groupId);
    
    const orphans = [
      ...orphanFolders.map(f => ({ type: 'folder' as const, id: f.id, data: f, order: f.order })),
      ...orphanLessons.map(l => ({ type: 'lesson' as const, id: l.id, data: l, order: l.order }))
    ].sort((a, b) => (a.order || 0) - (b.order || 0));

    return { groups: grps, orphans };
  }, [structure]);

  return (
    <div className="
        w-full lg:w-96 
        bg-[#121418] 
        border-t lg:border-t-0 lg:border-l border-gray-800 
        flex flex-col 
        h-[500px] lg:h-full 
        shrink-0 
        order-2 lg:order-2
    ">
      
      {/* HEADER DA SIDEBAR */}
      <div className="p-4 border-b border-gray-800 bg-[#0f1114] shrink-0">
        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-1">Módulo Atual</span>
        <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 mb-3">{moduleTitle}</h3>
        
        {/* Barra de Progresso do Módulo */}
        <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-green-500 transition-all duration-500 ease-out" 
                    style={{ width: `${modulePercentage}%` }} 
                ></div>
            </div>
            <span className="text-[10px] text-gray-400 font-mono w-8 text-right">{modulePercentage}%</span>
        </div>
      </div>

      {/* Lista Scrollável */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        
        {/* 1. ITENS ÓRFÃOS (Legados) */}
        {navigationGroups.orphans.map(item => {
          if (item.type === 'folder') {
            const folder = item.data;
            return (
              <FolderItem 
                key={folder.id} 
                folder={folder} 
                lessons={getLessonsInFolder(folder.id)}
                activeLessonId={activeLessonId}
                onSelectLesson={onSelectLesson}
                completedLessons={completedLessons}
                allSubModules={structure.subModules}
                allLessons={structure.lessons}
              />
            );
          } else {
            const lesson = item.data;
            return (
              <LessonRow 
                key={lesson.id} 
                lesson={lesson} 
                isActive={lesson.id === activeLessonId} 
                isCompleted={completedLessons.includes(lesson.id)}
                onClick={() => onSelectLesson(lesson)} 
              />
            );
          }
        })}

        {/* 2. GRUPOS (Acordeões) */}
        {navigationGroups.groups.map(group => (
          <GroupAccordion 
            key={group.id}
            group={group}
            activeLessonId={activeLessonId}
            onSelectLesson={onSelectLesson}
            completedLessons={completedLessons}
            getLessonsInFolder={getLessonsInFolder}
            allSubModules={structure.subModules}
            allLessons={structure.lessons}
          />
        ))}

        {structure.lessons.length === 0 && (
          <div className="text-center py-10 opacity-40">
            <p className="text-xs font-bold uppercase">Nenhum conteúdo</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponente de Grupo (Acordeão Nível 1)
interface GroupAccordionProps {
  group: { 
    id: string; 
    title: string; 
    items: Array<{ type: 'folder' | 'lesson', id: string, data: any, order: number }>; 
  };
  activeLessonId: string | null;
  onSelectLesson: (lesson: CourseLesson) => void;
  completedLessons: string[];
  getLessonsInFolder: (folderId: string) => CourseLesson[];
  allSubModules?: CourseSubModule[];
  allLessons?: CourseLesson[];
}

const GroupAccordion: React.FC<GroupAccordionProps> = ({ 
  group, 
  activeLessonId, 
  onSelectLesson, 
  completedLessons,
  getLessonsInFolder,
  allSubModules = [],
  allLessons = []
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Abre automaticamente se a aula ativa estiver dentro deste grupo (ou em suas subpastas)
  useEffect(() => {
    const hasActiveLesson = group.items.some(item => {
      if (item.type === 'lesson') return item.id === activeLessonId;
      if (item.type === 'folder') {
        const hasActiveInThisOrChildren = (fId: string): boolean => {
          if (allLessons.some(l => l.subModuleId === fId && l.id === activeLessonId)) return true;
          const subs = allSubModules.filter(s => s.parentId === fId);
          return subs.some(s => hasActiveInThisOrChildren(s.id));
        };
        return hasActiveInThisOrChildren(item.id);
      }
      return false;
    });
    if (hasActiveLesson) setIsOpen(true);
  }, [activeLessonId, group.items, allSubModules, allLessons]);

  // Cálculo de Progresso do Grupo (incluindo subpastas recursivamente)
  const groupAulas = useMemo(() => {
    const aulasDirect = group.items.filter(i => i.type === 'lesson').map(i => i.data);
    
    const getAllFolderLessons = (fId: string): CourseLesson[] => {
      const lessonsInF = allLessons.filter(l => l.subModuleId === fId);
      const childFKeys = allSubModules.filter(s => s.parentId === fId);
      return [...lessonsInF, ...childFKeys.flatMap(c => getAllFolderLessons(c.id))];
    };

    const aulasInFolders = group.items.filter(i => i.type === 'folder').flatMap(i => getAllFolderLessons(i.id));
    return [...aulasDirect, ...aulasInFolders];
  }, [group.items, allSubModules, allLessons]);

  const completedCount = groupAulas.filter(l => completedLessons.includes(l.id)).length;
  const isComplete = groupAulas.length > 0 && completedCount === groupAulas.length;

  return (
    <div className="mb-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left group
          ${isOpen ? 'bg-zinc-800/80 border border-zinc-700/50 shadow-lg' : 'bg-transparent hover:bg-zinc-800/40 border border-transparent'}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`p-1.5 rounded-md ${isOpen ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>
            <Layers size={14} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[10px] font-black uppercase tracking-wider truncate mb-0.5 ${isComplete ? 'text-green-500' : 'text-zinc-300'}`}>
              {group.title}
            </span>
            <span className="text-[9px] text-zinc-500 font-bold">
              {completedCount}/{groupAulas.length} CONCLUÍDAS
            </span>
          </div>
        </div>
        {isOpen ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
      </button>

      {isOpen && (
        <div className="mt-1 space-y-1 animate-in slide-in-from-top-1 duration-200">
          {group.items.map(item => {
            if (item.type === 'folder') {
              return (
                <div key={item.id} className="ml-2">
                  <FolderItem 
                    folder={item.data} 
                    lessons={getLessonsInFolder(item.id)}
                    activeLessonId={activeLessonId}
                    onSelectLesson={onSelectLesson}
                    completedLessons={completedLessons}
                    isNested
                    allSubModules={allSubModules}
                    allLessons={allLessons}
                  />
                </div>
              );
            } else {
              return (
                <div key={item.id} className="ml-2">
                  <LessonRow 
                    lesson={item.data} 
                    isActive={item.id === activeLessonId} 
                    isCompleted={completedLessons.includes(item.id)}
                    onClick={() => onSelectLesson(item.data)} 
                  />
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
};

// Subcomponente de Pasta
interface FolderItemProps {
    folder: CourseSubModule;
    lessons: CourseLesson[];
    activeLessonId: string | null;
    onSelectLesson: (lesson: CourseLesson) => void;
    completedLessons: string[];
    isNested?: boolean;
    allSubModules?: CourseSubModule[];
    allLessons?: CourseLesson[];
}

const FolderItem: React.FC<FolderItemProps> = ({ 
  folder, 
  lessons, 
  activeLessonId, 
  onSelectLesson, 
  completedLessons, 
  isNested,
  allSubModules = [],
  allLessons = []
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Lógica de Bloqueio (Drip Content)
    const isLocked = folder.publishDate && new Date(folder.publishDate) > new Date();
    const isRecording = folder.status === 'recording' || (folder.scheduledDate && new Date(folder.scheduledDate) > new Date());
    
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit'
        });
    };

    const formattedPublishDate = folder.publishDate ? new Date(folder.publishDate).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : '';

    // Abre automaticamente se a aula ativa estiver aqui ou em subpastas recursivamente
    useEffect(() => {
        const hasActiveInThisOrChildren = (fId: string): boolean => {
            if (allLessons.some(l => l.subModuleId === fId && l.id === activeLessonId)) return true;
            const subs = allSubModules.filter(s => s.parentId === fId);
            return subs.some(s => hasActiveInThisOrChildren(s.id));
        };
        if (hasActiveInThisOrChildren(folder.id)) setIsOpen(true);
    }, [activeLessonId, folder.id, allSubModules, allLessons]);

    // Subpastas e Aulas unificadas do Folder, ordenadas por 'order'
    const combinedFolderContents = useMemo(() => {
        const folders = allSubModules
            .filter(s => s.parentId === folder.id)
            .map(f => ({ type: 'folder' as const, id: f.id, data: f, order: f.order || 0 }));
            
        const childLessons = allLessons
            .filter(l => l.subModuleId === folder.id)
            .map(l => ({ type: 'lesson' as const, id: l.id, data: l, order: l.order || 0 }));
            
        return [...folders, ...childLessons].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [allSubModules, allLessons, folder.id]);

    // Progresso Recursivo
    const allFolderLessonsRecursive = useMemo(() => {
        const getAllFolderLessons = (fId: string): CourseLesson[] => {
            const lessonsInF = allLessons.filter(l => l.subModuleId === fId);
            const childFKeys = allSubModules.filter(s => s.parentId === fId);
            return [...lessonsInF, ...childFKeys.flatMap(c => getAllFolderLessons(c.id))];
        };
        return getAllFolderLessons(folder.id);
    }, [allLessons, allSubModules, folder.id]);

    const folderCompletedCount = allFolderLessonsRecursive.filter(l => completedLessons.includes(l.id)).length;
    const isFolderComplete = allFolderLessonsRecursive.length > 0 && folderCompletedCount === allFolderLessonsRecursive.length;

    return (
        <div className={`mb-1 ${isLocked ? 'opacity-60 cursor-not-allowed' : ''} ${isNested ? 'ml-2' : ''}`}>
            <button 
                onClick={() => !isLocked && setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-3 rounded transition-colors text-left group
                    ${isLocked ? 'bg-black/20' : 'hover:bg-[#1a1d24]'}
                `}
                disabled={isLocked}
            >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    {isLocked ? (
                        <div className="p-1 rounded bg-zinc-800 text-zinc-500 shrink-0">
                            <Clock size={12} className="opacity-50" />
                        </div>
                    ) : isRecording ? (
                        <div className="p-1 rounded bg-blue-500/10 text-blue-500 shrink-0">
                            <Video size={12} className="animate-pulse" />
                        </div>
                    ) : (
                        <svg className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-90 text-white' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    )}
                    
                    <div className="flex flex-col flex-1 min-w-0 pr-2">
                        <span className={`text-[11px] font-bold uppercase truncate ${isFolderComplete ? 'text-green-500' : isLocked ? 'text-gray-500' : 'text-gray-200 group-hover:text-white'}`}>
                            {folder.title}
                        </span>
                        
                        {/* Badge de Agendamento / Em Gravação */}
                        {folder.scheduledDate && (
                            <span className="mt-1 text-[9px] font-medium bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded w-fit border border-blue-500/20 whitespace-nowrap">
                                EM GRAVAÇÃO: {formatDate(folder.scheduledDate)}
                            </span>
                        )}

                        {isLocked && !folder.scheduledDate && (
                            <span className="text-[9px] text-[var(--plan-theme)]/70 font-bold uppercase tracking-tighter truncate">
                                Disponível em: {formattedPublishDate}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isFolderComplete && <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    {!isLocked && <span className="text-[9px] text-gray-600 font-mono">{folderCompletedCount}/{allFolderLessonsRecursive.length}</span>}
                </div>
            </button>

            {isOpen && !isLocked && (
                <div className="ml-2 pl-2 border-l border-gray-800 space-y-0.5 mt-1">
                    {combinedFolderContents.map(item => {
                        if (item.type === 'folder') {
                            return (
                                <FolderItem 
                                    key={item.id}
                                    folder={item.data}
                                    lessons={allLessons.filter(l => l.subModuleId === item.id).sort((a, b) => (a.order || 0) - (b.order || 0))}
                                    activeLessonId={activeLessonId}
                                    onSelectLesson={onSelectLesson}
                                    completedLessons={completedLessons}
                                    isNested
                                    allSubModules={allSubModules}
                                    allLessons={allLessons}
                                />
                            );
                        } else {
                            return (
                                <LessonRow 
                                    key={item.id} 
                                    lesson={item.data} 
                                    isActive={item.id === activeLessonId}
                                    isCompleted={completedLessons.includes(item.id)}
                                    onClick={() => onSelectLesson(item.data)} 
                                />
                            );
                        }
                    })}
                </div>
            )}
        </div>
    );
};

// Subcomponente de Linha de Aula (ATUALIZADO)
interface LessonRowProps {
    lesson: CourseLesson;
    isActive: boolean;
    isCompleted: boolean;
    onClick: () => void;
}

const LessonRow: React.FC<LessonRowProps> = ({ lesson, isActive, isCompleted, onClick }) => {
    
    // Define qual ícone mostrar baseado no tipo e status
    const Icon = () => {
        if (isCompleted) {
            return (
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
            );
        }

        if (lesson.type === 'pdf') {
            return (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
            );
        }
        // Padrão Vídeo
        return (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
        );
    };

    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group
                ${isActive 
                    ? 'bg-[var(--plan-theme)]/10 border border-[var(--plan-theme)]/20' 
                    : 'hover:bg-[#1a1d24] border border-transparent'
                }
            `}
        >
            {/* Ícone Dinâmico (Círculo) */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-colors 
                ${isCompleted 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : isActive 
                        ? 'bg-[var(--plan-theme)] border-[var(--plan-theme)] text-white' 
                        : 'bg-black border-gray-800 text-gray-500 group-hover:border-gray-600 group-hover:text-gray-300'
                }
            `}>
                <Icon />
            </div>
            
            {/* Título */}
            <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium block truncate 
                    ${isCompleted ? 'text-gray-500 line-through' : isActive ? 'text-[var(--plan-theme)]' : 'text-gray-400 group-hover:text-gray-200'}
                `}>
                    {lesson.title}
                </span>
            </div>
        </button>
    );
};