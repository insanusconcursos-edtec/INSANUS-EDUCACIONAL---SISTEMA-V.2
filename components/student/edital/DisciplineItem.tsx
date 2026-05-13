import React, { memo } from 'react';
import { 
  ChevronDown, ChevronUp, CheckCircle2, Layout, ClipboardList 
} from 'lucide-react';
import { Meta } from '../../../services/metaService';
import TopicItem from './TopicItem';

interface DisciplineItemProps {
    discipline: any;
    expandedDisciplines: Set<string>;
    toggleDiscipline: (id: string) => void;
    progress: number;
    openNotebook: (id: string, title: string, type: string, goals?: any, nodeData?: any, pdfUrl?: string) => void;
    completedMetaIds: Set<string>;
    activeUserMode: boolean;
    metaLookup: Record<string, Meta>;
    planId: string;
    structure: any;
    isEnabled?: boolean;
    isReadOnly?: boolean;
    handleToggleGoal?: (goal: Meta) => void;
    handleBatchToggle?: (ids: string[], isCompleted: boolean) => void;
    setActiveVideo?: (url: string | null) => void;
    setFlashcardModal?: (modal: any) => void;
    setMindMapModal?: (modal: any) => void;
    activeHighlightGoal?: string | null;
    activeHighlightTopic?: string | null;
    expandedTopics?: Set<string>;
    variant?: 'linear' | 'circular';
}

const DisciplineItem = memo(({ 
    discipline, 
    expandedDisciplines, 
    toggleDiscipline, 
    progress, 
    openNotebook,
    completedMetaIds,
    activeUserMode,
    metaLookup,
    planId,
    structure,
    handleToggleGoal,
    handleBatchToggle,
    setActiveVideo,
    setFlashcardModal,
    setMindMapModal,
    activeHighlightGoal,
    activeHighlightTopic,
    expandedTopics,
    isReadOnly = false,
    variant = 'linear'
}: DisciplineItemProps) => {
    const isExpanded = expandedDisciplines.has(discipline.id);
    const isComplete = progress === 100;

    return (
        <div 
            className={`
                border rounded-xl overflow-hidden transition-all duration-300
                ${isExpanded ? 'bg-zinc-950 border-zinc-700 shadow-xl' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}
            `}
        >
            {/* Accordion Header */}
            <div 
                onClick={() => toggleDiscipline(discipline.id)}
                className="flex items-center justify-between p-4 cursor-pointer select-none"
            >
                <div className="flex items-center gap-4 flex-1">
                    {variant === 'circular' ? (
                        <div className="relative w-12 h-12 shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-800" />
                                <circle 
                                    cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" fill="transparent" 
                                    className={`${isComplete ? 'text-emerald-500' : 'text-yellow-400'}`}
                                    strokeDasharray={125.6} 
                                    strokeDashoffset={125.6 - (125.6 * progress) / 100} 
                                    strokeLinecap="round" 
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                                {Math.round(progress)}%
                            </div>
                        </div>
                    ) : (
                        <div className={`p-2 rounded-lg ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-400'}`}>
                            {isComplete ? <CheckCircle2 size={20} /> : <Layout size={20} />}
                        </div>
                    )}
                    
                    <div className="flex-1">
                        <h3 className={`text-sm font-black uppercase tracking-tight ${isComplete ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-white'}`}>
                            {discipline.name}
                        </h3>
                        
                        {/* Discipline Progress Bar (Only for linear variant) */}
                        {variant === 'linear' && (
                            <div className="flex items-center gap-3 mt-1.5 max-w-[200px]">
                                <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-zinc-500'}`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <span className="text-[9px] font-mono text-zinc-500">{progress}%</span>
                            </div>
                        )}

                        {variant === 'circular' && (
                            <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">
                                {discipline.topics.length} Tópicos Principais
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-zinc-600 ml-4 flex items-center gap-3">
                    {/* CADERNO DE QUESTÕES (Exclusivo Nível Disciplina) */}
                    {!isReadOnly && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                openNotebook(discipline.id, discipline.name, 'questions', null, discipline);
                            }}
                            className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg border border-amber-500/20 transition-all group"
                            title="Caderno de Questões"
                        >
                            <ClipboardList size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                    )}

                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {/* Accordion Content (Topics) */}
            {isExpanded && (
                <div className="border-t border-zinc-800/50 bg-black/20">
                    {discipline.topics.length === 0 ? (
                        <div className="p-6 text-center text-zinc-600 text-xs font-bold uppercase">
                            Nenhum tópico cadastrado nesta disciplina.
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-800/30">
                            {discipline.topics.map((topic: any) => (
                                <TopicItem 
                                    key={topic.id}
                                    item={topic}
                                    completedMetaIds={completedMetaIds}
                                    activeUserMode={isReadOnly ? false : activeUserMode}
                                    isReadOnly={isReadOnly}
                                    metaLookup={metaLookup}
                                    planId={planId}
                                    disciplineId={discipline.id}
                                    disciplineName={discipline.name}
                                    studyLevels={structure.studyLevels}
                                    onToggleGoal={handleToggleGoal}
                                    onBatchToggle={handleBatchToggle}
                                    onPlayVideo={setActiveVideo}
                                    onOpenNotes={(id, title, goals, pdfUrl) => openNotebook(id, title, 'note', goals, topic, pdfUrl)}
                                    onOpenFlashcards={(id, title) => setFlashcardModal?.({ isOpen: true, nodeId: id, nodeTitle: title })}
                                    onOpenMindMap={(id, title) => setMindMapModal?.({ isOpen: true, nodeId: id, nodeTitle: title })}
                                    highlightGoalId={activeHighlightGoal}
                                    activeHighlightTopicId={activeHighlightTopic}
                                    expandedTopics={expandedTopics}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

DisciplineItem.displayName = 'DisciplineItem';

export default DisciplineItem;
