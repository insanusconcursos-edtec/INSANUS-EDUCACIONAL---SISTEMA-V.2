import React, { useState } from 'react';
import { MentorshipModule, MentorshipLesson } from '../../../types/mentorship';

// Ícones
const FolderIcon = () => <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>;
const PlayIcon = () => <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ChevronRight = () => <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;

interface StudentModuleViewProps {
  module: MentorshipModule;
  onBack: () => void;
  onLessonSelect: (lesson: MentorshipLesson) => void;
}

export function StudentModuleView({ module, onBack, onLessonSelect }: StudentModuleViewProps) {
  // Navegação interna (Breadcrumbs)
  const [navigationPath, setNavigationPath] = useState<{id: string, title: string}[]>([]);
  
  // Estado para pastas expandidas (Acordeão)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Helper para encontrar o container atual (Raiz ou Subpasta)
  const getCurrentContainer = () => {
    let current: any = module;
    for (const pathItem of navigationPath) {
        if (current.subModules) {
            current = current.subModules.find((sub: any) => sub.id === pathItem.id);
        }
    }
    return current;
  };

  const currentContainer = getCurrentContainer();

  // Toggle Acordeão
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Helper para ordenar itens (Pastas e Aulas)
  const getSortedItems = (container: any) => {
    const lessons = (container.lessons || []).map((l: any) => ({ type: 'lesson', data: l, order: l.order || 0 }));
    const submodules = (container.subModules || []).map((s: any) => ({ type: 'submodule', data: s, order: s.order || 0 }));
    return [...lessons, ...submodules].sort((a: any, b: any) => a.order - b.order);
  };

  const items = getSortedItems(currentContainer);

  return (
    <div className="animate-in slide-in-from-right duration-300">
      
      {/* --- HEADER DO MÓDULO --- */}
      <div className="mb-8 border-b border-gray-800 pb-4">
        {/* Botão Voltar */}
        <button 
            onClick={() => {
                if (navigationPath.length > 0) {
                    setNavigationPath(prev => prev.slice(0, -1));
                } else {
                    onBack();
                }
            }}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 text-sm font-bold uppercase tracking-wider"
        >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {navigationPath.length > 0 ? 'Voltar' : 'Voltar para Mentoria'}
        </button>

        <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            {navigationPath.length === 0 && (
                <img src={module.coverUrl} className="w-10 h-14 object-cover rounded border border-gray-700" alt="Capa" />
            )}
            {navigationPath.length > 0 ? currentContainer.title : module.title}
        </h2>
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
            <span className={`cursor-pointer hover:text-white ${navigationPath.length === 0 ? 'text-white font-bold' : ''}`} onClick={() => setNavigationPath([])}>
                Início
            </span>
            {navigationPath.map((item, idx) => (
                <React.Fragment key={item.id}>
                    <span>/</span>
                    <span 
                        className={`cursor-pointer hover:text-white ${idx === navigationPath.length - 1 ? 'text-white font-bold' : ''}`}
                        onClick={() => setNavigationPath(prev => prev.slice(0, idx + 1))}
                    >
                        {item.title}
                    </span>
                </React.Fragment>
            ))}
        </div>
      </div>

      {/* --- LISTA DE CONTEÚDO --- */}
      <div className="space-y-3 max-w-5xl">
        {items.length === 0 && (
            <div className="p-8 text-center border border-dashed border-gray-800 rounded-lg text-gray-500">
                Esta pasta está vazia.
            </div>
        )}

        {items.map((item: any) => {
            // --- RENDERIZAÇÃO DE PASTA ---
            if (item.type === 'submodule') {
                const isOpen = expandedFolders[item.data.id];
                return (
                    <div key={item.data.id} className="border border-gray-800 rounded-lg bg-[#15171b] overflow-hidden">
                        <div 
                            onClick={() => toggleFolder(item.data.id)}
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1a1d24] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                                    <ChevronRight />
                                </div>
                                <FolderIcon />
                                <span className="text-white font-bold">{item.data.title}</span>
                                <span className="text-xs text-gray-600 ml-2">{(item.data.lessons?.length || 0) + (item.data.subModules?.length || 0)} itens</span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setNavigationPath([...navigationPath, { id: item.data.id, title: item.data.title }]); }}
                                className="px-3 py-1 text-xs font-bold text-gray-400 border border-gray-700 rounded hover:text-white hover:border-gray-500"
                            >
                                ABRIR PASTA
                            </button>
                        </div>

                        {/* Conteúdo da Pasta (Preview) */}
                        {isOpen && (
                            <div className="bg-black/20 border-t border-gray-800 p-2 pl-8">
                                {(item.data.lessons || []).map((l: any) => (
                                    <div 
                                        key={l.id} 
                                        onClick={() => onLessonSelect(l)}
                                        className="p-2 flex items-center gap-3 hover:bg-white/5 rounded cursor-pointer text-gray-300 hover:text-white"
                                    >
                                        <PlayIcon />
                                        <span className="text-sm">{l.title}</span>
                                    </div>
                                ))}
                                {(!item.data.lessons?.length && !item.data.subModules?.length) && <p className="text-xs text-gray-600 p-2">Vazio</p>}
                            </div>
                        )}
                    </div>
                );
            }

            // --- RENDERIZAÇÃO DE AULA ---
            if (item.type === 'lesson') {
                return (
                    <div 
                        key={item.data.id}
                        onClick={() => onLessonSelect(item.data)}
                        className="p-4 rounded-lg bg-[#1a1d24] border border-gray-800 hover:border-red-600/50 hover:bg-[#202329] transition-all cursor-pointer flex justify-between items-center group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center border border-gray-700 group-hover:border-red-500 transition-colors">
                                <PlayIcon />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm md:text-base group-hover:text-red-500 transition-colors">
                                    {item.data.title}
                                </h4>
                                <div className="flex gap-2 mt-1">
                                    {item.data.contents?.some((c:any) => c.type === 'video') && <span className="text-[10px] bg-red-900/20 text-red-500 px-1.5 rounded border border-red-900/30">VÍDEO</span>}
                                    {item.data.contents?.some((c:any) => c.type === 'pdf') && <span className="text-[10px] bg-blue-900/20 text-blue-500 px-1.5 rounded border border-blue-900/30">PDF</span>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase rounded shadow-lg hover:bg-red-500">
                                Acessar
                            </button>
                        </div>
                    </div>
                );
            }
            return null;
        })}
      </div>
    </div>
  );
}