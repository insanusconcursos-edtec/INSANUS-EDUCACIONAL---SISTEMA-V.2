import React, { useState, useEffect } from 'react';
import { MentorshipModule, MentorshipLesson } from '../../../types/mentorship';
import { mentorshipService } from '../../../services/mentorshipService';
import { useAuth } from '../../../contexts/AuthContext';

// Ícones
const PlayIcon = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;
const CheckSolidIcon = () => <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
const ChevronDown = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const FileIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;

interface StudentLessonPlayerProps {
  module: MentorshipModule;
  planId: string; // Novo Prop obrigatório
  onBack: () => void;
}

export function StudentLessonPlayer({ module, planId, onBack }: StudentLessonPlayerProps) {
  const { currentUser: user } = useAuth(); // Pegar ID do usuário logado (useAuth returns currentUser)
  const [activeLesson, setActiveLesson] = useState<MentorshipLesson | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  
  // ESTADO DE PROGRESSO: Lista de IDs das aulas concluídas
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  // 1. Carregar aula inicial e expandir pastas
  useEffect(() => {
    if (module) {
        const firstLesson = module.lessons?.[0] || module.subModules?.[0]?.lessons?.[0];
        if (firstLesson) setActiveLesson(firstLesson);
        
        const initialExpanded: Record<string, boolean> = {};
        module.subModules?.forEach(sub => initialExpanded[sub.id] = true);
        setExpandedFolders(initialExpanded);
    }
  }, [module]);

  // 2. Carregar Progresso do Banco de Dados
  useEffect(() => {
    const loadProgress = async () => {
        if (user && planId) {
            const progress = await mentorshipService.getStudentProgress(user.uid, planId);
            setCompletedLessons(progress);
        }
    };
    loadProgress();
  }, [user, planId]);

  // 3. Função para Marcar/Desmarcar Conclusão
  const handleToggleComplete = async () => {
    if (!user || !activeLesson) return;

    // Atualização Otimista (Muda na hora visualmente)
    const isCurrentlyCompleted = completedLessons.includes(activeLesson.id);
    let newCompletedList;
    
    if (isCurrentlyCompleted) {
        newCompletedList = completedLessons.filter(id => id !== activeLesson.id);
    } else {
        newCompletedList = [...completedLessons, activeLesson.id];
    }
    setCompletedLessons(newCompletedList); // Atualiza estado local

    // Atualiza no Banco
    setIsLoadingProgress(true);
    try {
        await mentorshipService.toggleLessonCompletion(user.uid, planId, activeLesson.id);
    } catch (error) {
        console.error("Erro ao salvar progresso", error);
        // Reverte se der erro (opcional)
    } finally {
        setIsLoadingProgress(false);
    }
  };

  const renderContent = () => {
    if (!activeLesson) return <div className="text-center py-20 text-gray-500">Selecione uma aula para começar.</div>;

    const videoContent = activeLesson.contents?.find(c => c.type === 'video');
    const pdfContent = activeLesson.contents?.find(c => c.type === 'pdf');
    const downloads = activeLesson.contents?.filter(c => c.type === 'pdf' || c.type === 'link') || [];
    const contentCount = activeLesson.contents?.length || 0;
    
    // Verifica se a aula atual está concluída
    const isCompleted = completedLessons.includes(activeLesson.id);

    return (
      <div className="flex flex-col h-full">
        {/* PLAYER */}
        <div className="w-full aspect-video bg-black shrink-0 rounded-xl overflow-hidden border border-gray-800 shadow-2xl relative mb-6">
            {videoContent ? (
                <iframe 
                    src={videoContent.videoUrl} 
                    className="w-full h-full" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                    title={videoContent.title}
                />
            ) : pdfContent ? (
                <div className="w-full h-full flex items-center justify-center bg-[#15171b]">
                    <div className="text-center">
                        <FileIcon />
                        <p className="mt-2 text-gray-400">Esta aula é um material de leitura.</p>
                        <a href={pdfContent.fileUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block px-6 py-2 bg-[var(--plan-theme)] text-white rounded hover:brightness-110 transition-colors">
                            Ler PDF
                        </a>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#15171b] text-gray-500">
                    Selecione um conteúdo.
                </div>
            )}
        </div>

        {/* BARRA DE TÍTULO E AÇÕES */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-gray-800 pb-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-2">{activeLesson.title}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="bg-gray-800 px-2 py-0.5 rounded text-xs uppercase tracking-wider text-white">AULA</span>
                    <span>{contentCount} {contentCount === 1 ? 'CONTEÚDO' : 'CONTEÚDOS'}</span>
                </div>
            </div>
            
            {/* BOTÃO INTELIGENTE DE CONCLUSÃO */}
            <button 
                onClick={handleToggleComplete}
                disabled={isLoadingProgress}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold uppercase text-xs tracking-wider transition-all border
                    ${isCompleted 
                        ? 'bg-green-600/10 border-green-500 text-green-500 hover:bg-green-600/20' 
                        : 'bg-[#1a1d24] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                    }
                `}
            >
                {isCompleted ? <CheckSolidIcon /> : <div className="w-4 h-4 rounded-full border-2 border-current"></div>}
                {isCompleted ? 'AULA CONCLUÍDA' : 'MARCAR COMO CONCLUÍDA'}
            </button>
        </div>

        {/* DOWNLOADS */}
        {downloads.length > 0 && (
            <div className="mb-12">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--plan-theme)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Arquivos e Links
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {downloads.map(item => (
                        <a 
                            key={item.id} 
                            href={item.type === 'pdf' ? item.fileUrl : item.linkUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-3 p-4 bg-[#1a1d24] hover:bg-[#202329] border border-gray-800 rounded-lg transition-colors group"
                        >
                            <div className="p-2 bg-black rounded text-gray-400 group-hover:text-white transition-colors">
                                {item.type === 'pdf' ? <FileIcon /> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-200 truncate group-hover:text-white">{item.title}</p>
                                <p className="text-xs text-gray-500 uppercase">{item.type}</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                    ))}
                </div>
            </div>
        )}
      </div>
    );
  };

  // Helper para renderizar item da lista com ícone de check
  const renderLessonItem = (lesson: MentorshipLesson) => {
    const isCompleted = completedLessons.includes(lesson.id);
    const isActive = activeLesson?.id === lesson.id;

    return (
        <div 
            key={lesson.id}
            onClick={() => setActiveLesson(lesson)}
            className={`
                flex items-start gap-3 cursor-pointer transition-colors border-l-4 py-3 pr-4
                ${isActive 
                    ? 'border-[var(--plan-theme)] bg-[#1a1d24]' 
                    : 'border-transparent hover:bg-[#1a1d24]'
                }
                ${isCompleted ? 'opacity-70 hover:opacity-100' : ''}
            `}
            style={{ paddingLeft: '1rem' }} // Padding fixo para alinhar
        >
            <div className="mt-0.5 shrink-0">
                {/* ÍCONE DINÂMICO: CHECK OU PLAY */}
                {isCompleted ? (
                    <div className="text-green-500"><CheckSolidIcon /></div>
                ) : (
                    <div className={isActive ? 'text-[var(--plan-theme)]' : 'text-gray-600'}>
                        <PlayIcon />
                    </div>
                )}
            </div>
            <div>
                <span className={`text-sm leading-snug block ${isActive || isCompleted ? 'text-white font-medium' : 'text-gray-400'}`}>
                    {lesson.title}
                </span>
                <span className="text-[10px] text-gray-600 uppercase mt-1 block">Videoaula</span>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full lg:h-[calc(100vh-100px)] pt-6 gap-6 overflow-y-auto lg:overflow-hidden bg-zinc-950 animate-in fade-in">
      
      {/* --- HEADER MOBILE (SÓ APARECE EM TELAS PEQUENAS) --- */}
      <div className="lg:hidden p-4 bg-[#121418] border-b border-gray-800 flex justify-between items-center shrink-0">
        <button onClick={onBack} className="text-gray-400 text-sm">Voltar</button>
        <span className="font-bold text-white truncate max-w-[200px] text-sm">{module.title}</span>
        <div className="w-8"></div>
      </div>

      {/* --- COLUNA ESQUERDA: PLAYER (CONTEÚDO) --- */}
      <div className="flex-1 w-full lg:w-2/3 xl:w-3/4 flex flex-col overflow-y-auto hide-scrollbar p-4 md:p-8 bg-black/50">
        <div className="max-w-5xl mx-auto w-full">
            
            {/* Breadcrumb Desktop */}
            <button 
                onClick={onBack}
                className="hidden lg:flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors text-sm uppercase font-bold tracking-widest"
            >
                &larr; Voltar para o Portal
            </button>

            {renderContent()}
        </div>
      </div>

      {/* --- COLUNA DIREITA: SIDEBAR (LISTA DE AULAS) --- */}
      <div className="w-full lg:w-1/3 xl:w-1/4 h-auto lg:h-full shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-background/50 flex flex-col overflow-y-auto">
        
        {/* Cabeçalho da Sidebar */}
        <div className="p-6 border-b border-gray-800">
            <h2 className="text-white font-bold text-lg leading-tight mb-2">{module.title}</h2>
            
            {/* Barra de Progresso Real */}
            <div className="flex items-center gap-2">
                <div className="h-1 flex-1 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-green-500 transition-all duration-500"
                        style={{ 
                            width: `${(completedLessons.length / Math.max(1, (module.lessons?.length || 0) + (module.subModules?.reduce((acc, sub) => acc + (sub.lessons?.length || 0), 0) || 0))) * 100}%` 
                        }}
                    ></div>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                    {Math.round((completedLessons.length / Math.max(1, (module.lessons?.length || 0) + (module.subModules?.reduce((acc, sub) => acc + (sub.lessons?.length || 0), 0) || 0))) * 100)}%
                </span>
            </div>
        </div>

        {/* Lista Scrollável */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            
            {/* 1. LISTA DE AULAS SOLTAS (FORA DE PASTAS) */}
            {module.lessons && module.lessons.length > 0 && (
                <div className="border-b border-gray-800/50">
                    {module.lessons.map(lesson => renderLessonItem(lesson))}
                </div>
            )}

            {/* 2. LISTA DE SUBMÓDULOS (PASTAS) */}
            {module.subModules?.map((subModule) => {
                const isOpen = expandedFolders[subModule.id];
                return (
                    <div key={subModule.id} className="border-b border-gray-800/50">
                        {/* Header do Acordeão */}
                        <div 
                            onClick={() => setExpandedFolders(prev => ({...prev, [subModule.id]: !prev[subModule.id]}))}
                            className="p-4 flex justify-between items-center cursor-pointer hover:bg-[#1a1d24] transition-colors group"
                        >
                            <span className="text-sm font-bold text-gray-300 group-hover:text-white uppercase tracking-wide">
                                {subModule.title}
                            </span>
                            <div className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                <ChevronDown />
                            </div>
                        </div>

                        {/* Conteúdo do Acordeão (Aulas) */}
                        {isOpen && (
                            <div className="bg-black/20">
                                {subModule.lessons?.map(lesson => renderLessonItem(lesson))}
                                {(!subModule.lessons || subModule.lessons.length === 0) && (
                                    <div className="pl-8 py-3 text-xs text-gray-600 italic">Pasta vazia</div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
}