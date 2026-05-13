
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Trash2, ChevronRight, ChevronDown, 
  PlayCircle, FileText, BrainCircuit, Layers, X,
  ArrowUp, ArrowDown, StickyNote
} from 'lucide-react';
import { MindMapNode, Flashcard } from '../../../services/metaService';
import { CourseEditalTopic, LinkedLesson, MaterialPDF } from '../../../../types/courseEdital';
import { courseService } from '../../../../services/courseService';

import MindMapManager from '../../metas/tools/mindmap/MindMapManager';
import FlashcardEditor from '../../metas/tools/FlashcardEditor';
import { LinkLessonModal } from './LinkLessonModal';
import { ConfirmationModal } from '../../../../components/ui/ConfirmationModal';
import { RichTextEditor } from '../../../../components/ui/RichTextEditor';

interface Props {
  topic: CourseEditalTopic;
  onUpdate: (updated: CourseEditalTopic) => void;
  onDelete: () => void;
  depth?: number;
  courseId: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const AdminCourseEditalTopic: React.FC<Props> = ({ 
    topic, onUpdate, onDelete, depth = 0, courseId,
    onMoveUp, onMoveDown, isFirst, isLast
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(topic.name);
  const [isUploading, setIsUploading] = useState(false);
  const [nextPdfType, setNextPdfType] = useState<'TEORIA' | 'QUESTOES'>('TEORIA');

  // Estados para Observação
  const [isEditingObservation, setIsEditingObservation] = useState(false);

  // Estados para Modais das Ferramentas
  const [activeTool, setActiveTool] = useState<'MAP' | 'FLASHCARD' | 'LESSON_LINK' | null>(null);
  
  // Estados para Modal de Exclusão de Subtópico
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [subtopicToDelete, setSubtopicToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS BÁSICOS ---
  const handleNameBlur = () => {
    setIsEditingName(false);
    if (localName !== topic.name) {
        onUpdate({ ...topic, name: localName });
    }
  };

  const handleAddSubtopic = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newSub: CourseEditalTopic = {
        id: generateId(),
        name: 'Novo Subtópico',
        subtopics: [],
        linkedLessons: [],
        materialPdfs: [],
        contentData: { mindMap: [], flashcards: [] }
    };
    onUpdate({ ...topic, subtopics: [...topic.subtopics, newSub] });
    setIsExpanded(true);
  };

  const handleSubtopicUpdate = (updatedSub: CourseEditalTopic) => {
    onUpdate({
        ...topic,
        subtopics: topic.subtopics.map(s => s.id === updatedSub.id ? updatedSub : s)
    });
  };

  // --- LÓGICA DE EXCLUSÃO DE SUBTÓPICO ---
  
  // 1. Solicita exclusão (Abre Modal)
  const handleSubtopicDeleteRequest = (subId: string) => {
    setSubtopicToDelete(subId);
    setIsDeleteModalOpen(true);
  };

  // 2. Confirma exclusão (Remove do array e fecha modal)
  const confirmSubtopicDelete = () => {
    if(subtopicToDelete) {
        onUpdate({
            ...topic,
            subtopics: topic.subtopics.filter(s => s.id !== subtopicToDelete)
        });
        setIsDeleteModalOpen(false);
        setSubtopicToDelete(null);
    }
  };

  // --- REORDENAÇÃO DE SUBTÓPICOS ---
  const handleMoveSubtopic = (index: number, direction: 'up' | 'down') => {
      const subs = topic.subtopics;
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === subs.length - 1)) return;

      const newSubs = [...subs];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      [newSubs[index], newSubs[targetIndex]] = [newSubs[targetIndex], newSubs[index]];

      onUpdate({ ...topic, subtopics: newSubs });
  };

  // --- HANDLERS DE CONTEÚDO (IA/LINK/PDF) ---
  const handleUpdateMindMap = (nodes: MindMapNode[]) => {
    onUpdate({ ...topic, contentData: { ...topic.contentData, mindMap: nodes } });
  };

  const handleUpdateFlashcards = (cards: Flashcard[]) => {
    onUpdate({ ...topic, contentData: { ...topic.contentData, flashcards: cards } });
  };

  const handleSaveLinkedLessons = (selectedLessons: LinkedLesson[]) => {
      onUpdate({ ...topic, linkedLessons: selectedLessons });
  };

  const handleRemoveLesson = (lessonId: string) => {
      const newLessons = (topic.linkedLessons || []).filter(l => l.id !== lessonId);
      onUpdate({ ...topic, linkedLessons: newLessons });
  };

  const handleUploadPDFClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsUploading(true);
          try {
              const result = await courseService.uploadEditalFile(file, courseId, topic.id);
              const newPdf: MaterialPDF = {
                  title: file.name,
                  url: result.url,
                  storagePath: result.path,
                  pdfType: nextPdfType
              };
              const updatedPdfs = [...(topic.materialPdfs || []), newPdf];
              onUpdate({ ...topic, materialPdfs: updatedPdfs });
          } catch (_error) {
              alert("Erro ao fazer upload do PDF.");
          } finally {
              setIsUploading(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      }
  };

  const handleRemovePDF = (url: string) => {
      const newPdfs = (topic.materialPdfs || []).filter(p => p.url !== url);
      onUpdate({ ...topic, materialPdfs: newPdfs });
  };

  const handleUpdatePdfType = (url: string, type: 'TEORIA' | 'QUESTOES') => {
      const newPdfs = (topic.materialPdfs || []).map(p => 
          p.url === url ? { ...p, pdfType: type } : p
      );
      onUpdate({ ...topic, materialPdfs: newPdfs });
  };


  // Badges e Estilos
  const mapCount = topic.contentData?.mindMap?.length || 0;
  const flashCount = topic.contentData?.flashcards?.length || 0;
  const lessonsCount = topic.linkedLessons?.length || 0;
  const pdfsCount = topic.materialPdfs?.length || 0;
  const hasObservation = !!topic.observation && topic.observation.trim() !== '<p><br></p>' && topic.observation.trim() !== '';
  
  const isSubtopic = depth > 0;
  const containerClass = isSubtopic 
    ? "bg-[#121418] border-l-2 border-l-zinc-700 ml-4 my-1" 
    : "bg-zinc-900 border border-zinc-800 my-1 rounded-lg";

  return (
    <div className={`flex flex-col ${containerClass} transition-all animate-in fade-in`}>
      
      {/* HEADER DO TÓPICO */}
      <div 
        className={`flex items-center justify-between group hover:bg-zinc-800/50 p-2 transition-colors cursor-pointer ${isSubtopic ? 'rounded-r' : 'rounded'}`} 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button className={`text-zinc-500 hover:text-white transition-colors w-5 flex justify-center`}>
             {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          
          {isEditingName ? (
              <input 
                 value={localName}
                 onChange={(e) => setLocalName(e.target.value)}
                 onBlur={handleNameBlur}
                 onClick={e => e.stopPropagation()}
                 autoFocus
                 className="bg-black border border-zinc-600 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500 w-full max-w-[400px]"
              />
          ) : (
              <div className="flex items-center gap-2 overflow-hidden flex-wrap">
                <span 
                    onClick={(e) => { e.stopPropagation(); setIsEditingName(true); }}
                    className={`hover:text-white text-xs cursor-text transition-colors truncate font-medium ${isSubtopic ? 'text-zinc-400' : 'text-zinc-200'}`}
                >
                    {topic.name}
                </span>
                
                {lessonsCount > 0 && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 flex items-center gap-0.5"><PlayCircle size={8}/> {lessonsCount}</span>}
                {pdfsCount > 0 && <span className="text-[9px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20 flex items-center gap-0.5"><FileText size={8}/> {pdfsCount}</span>}
                {mapCount > 0 && <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 flex items-center gap-0.5"><BrainCircuit size={8}/> Mapa</span>}
                {flashCount > 0 && <span className="text-[9px] bg-pink-500/10 text-pink-400 px-1.5 py-0.5 rounded border border-pink-500/20 flex items-center gap-0.5"><Layers size={8}/> Cards</span>}
                {hasObservation && <span className="text-[9px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20 flex items-center gap-0.5"><StickyNote size={8}/> Obs</span>}
              </div>
          )}
        </div>

        {/* BOTÕES DE AÇÃO (HOVER) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            
            {/* Reordenação */}
            <div className="flex items-center bg-black/40 rounded border border-zinc-800 mr-2">
                <button onClick={onMoveUp} disabled={isFirst} className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded-l disabled:opacity-20" title="Mover para Cima">
                    <ArrowUp size={10} />
                </button>
                <div className="w-px h-3 bg-zinc-800"></div>
                <button onClick={onMoveDown} disabled={isLast} className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded-r disabled:opacity-20" title="Mover para Baixo">
                    <ArrowDown size={10} />
                </button>
            </div>
            
            {/* Botão de Observação */}
            <button 
                onClick={() => { setIsEditingObservation(!isEditingObservation); setIsExpanded(true); }}
                className={`p-1.5 rounded mr-2 transition-colors ${isEditingObservation || (topic.observation && topic.observation !== '<p><br></p>' && topic.observation !== '') ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-500/10'}`} 
                title="Adicionar/Editar Observação"
            >
                <StickyNote size={14} />
            </button>

            {/* Atalhos Rápidos */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded mr-2 overflow-hidden shadow-sm">
                <button onClick={() => setActiveTool('LESSON_LINK')} className="p-1.5 text-blue-500 hover:bg-blue-900/30 hover:text-blue-400" title="Vincular Aulas"><PlayCircle size={12} /></button>
                <div className="w-px bg-zinc-800"></div>
                
                <div className="flex items-center bg-zinc-950/50">
                    <select 
                        value={nextPdfType}
                        onChange={(e) => setNextPdfType(e.target.value as any)}
                        className="bg-transparent text-[8px] text-zinc-400 px-1 border-none focus:ring-0 cursor-pointer hover:text-white"
                        title="Tipo do próximo PDF"
                        onClick={e => e.stopPropagation()}
                    >
                        <option value="TEORIA">TEORIA</option>
                        <option value="QUESTOES">QUESTÕES</option>
                    </select>
                    <button onClick={handleUploadPDFClick} disabled={isUploading} className="p-1.5 text-orange-500 hover:bg-orange-900/30 hover:text-orange-400 disabled:opacity-50" title="Upload PDF">
                        {isUploading ? <span className="animate-spin text-[8px]">↻</span> : <FileText size={12} />}
                    </button>
                </div>
                <input type="file" ref={fileInputRef} accept="application/pdf" className="hidden" onChange={handleFileChange} />
                
                <div className="w-px bg-zinc-800"></div>
                <button onClick={() => setActiveTool('MAP')} className="p-1.5 text-purple-500 hover:bg-purple-900/30 hover:text-purple-400" title="Mapa Mental"><BrainCircuit size={12} /></button>
                <div className="w-px bg-zinc-800"></div>
                <button onClick={() => setActiveTool('FLASHCARD')} className="p-1.5 text-pink-500 hover:bg-pink-900/30 hover:text-pink-400" title="Flashcards"><Layers size={12} /></button>
            </div>

            <button onClick={handleAddSubtopic} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded" title="Adicionar Subtópico">
                <Plus size={14} />
            </button>
            
            {/* BOTÃO EXCLUIR O PRÓPRIO TÓPICO */}
            <button onClick={onDelete} className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-900/20 rounded" title="Excluir">
                <Trash2 size={14} />
            </button>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO (EXPANDIDA) */}
      {isExpanded && (
          <div className="pl-6 pr-2 pb-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
              
              {/* --- ÁREA DE OBSERVAÇÃO --- */}
              {(isEditingObservation || (topic.observation && topic.observation !== '<p><br></p>' && topic.observation !== '')) && (
                  <div className="mb-4 mt-2">
                      {isEditingObservation ? (
                          <div className="space-y-2 animate-in fade-in">
                              <RichTextEditor 
                                  value={topic.observation || ''} 
                                  onChange={(val) => onUpdate({ ...topic, observation: val })}
                                  placeholder="Digite observações, dicas ou orientações para este tópico..."
                              />
                              <div className="flex justify-end">
                                  <button onClick={() => setIsEditingObservation(false)} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-[10px] uppercase font-bold rounded transition-colors">
                                      Concluir Observação
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div 
                            className="p-4 bg-[#16181c] border border-gray-800 rounded-lg group/obs relative cursor-pointer hover:border-yellow-500/50 transition-colors"
                            onClick={() => setIsEditingObservation(true)}
                            title="Clique para editar"
                          >
                            <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider block mb-2 flex items-center gap-2">
                                <StickyNote size={12} /> Observação
                            </span>
                            <div className="prose prose-invert prose-sm max-w-none text-gray-300 text-xs" dangerouslySetInnerHTML={{ __html: topic.observation || '' }} />
                          </div>
                      )}
                  </div>
              )}

              {/* Lista de Aulas Vinculadas */}
              {topic.linkedLessons && topic.linkedLessons.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                      {topic.linkedLessons.map(lesson => (
                          <div key={lesson.id} className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded text-[10px] text-blue-300 group/item hover:border-blue-500/40">
                              <PlayCircle size={10} />
                              <span className="truncate max-w-[150px]">{lesson.title}</span>
                              <button onClick={() => handleRemoveLesson(lesson.id)} className="hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity ml-1"><X size={10} /></button>
                          </div>
                      ))}
                  </div>
              )}

              {/* Lista de PDFs */}
              {topic.materialPdfs && topic.materialPdfs.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                      {topic.materialPdfs.map((pdf, idx) => {
                          const isTheory = (pdf.pdfType || 'TEORIA') === 'TEORIA';
                          return (
                            <div key={idx} className={`flex items-center gap-1.5 ${isTheory ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300' : 'bg-orange-500/10 border-orange-500/20 text-orange-300'} border px-2 py-1 rounded text-[10px] group/item hover:border-opacity-50`}>
                                <FileText size={10} />
                                <span className="truncate max-w-[120px]">{pdf.title}</span>
                                <select 
                                    value={pdf.pdfType || 'TEORIA'}
                                    onChange={(e) => handleUpdatePdfType(pdf.url, e.target.value as any)}
                                    className="bg-transparent border-none text-[8px] p-0 focus:ring-0 cursor-pointer opacity-60 hover:opacity-100"
                                >
                                    <option value="TEORIA">T</option>
                                    <option value="QUESTOES">Q</option>
                                </select>
                                <button onClick={() => handleRemovePDF(pdf.url)} className="hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity ml-1"><X size={10} /></button>
                            </div>
                          );
                      })}
                  </div>
              )}

              {/* Renderização Recursiva de Subtópicos */}
              {topic.subtopics.length > 0 && (
                <div className="pt-1 flex flex-col gap-1">
                    {topic.subtopics.map((sub, index) => (
                        <AdminCourseEditalTopic 
                            key={sub.id}
                            topic={sub}
                            onUpdate={handleSubtopicUpdate}
                            // Passa a função de solicitação de exclusão do SUBTÓPICO
                            onDelete={() => handleSubtopicDeleteRequest(sub.id)}
                            depth={depth + 1}
                            courseId={courseId}
                            onMoveUp={() => handleMoveSubtopic(index, 'up')}
                            onMoveDown={() => handleMoveSubtopic(index, 'down')}
                            isFirst={index === 0}
                            isLast={index === topic.subtopics.length - 1}
                        />
                    ))}
                </div>
              )}
              
              {/* Mensagem de Vazio */}
              {topic.subtopics.length === 0 && lessonsCount === 0 && pdfsCount === 0 && !hasObservation && !isEditingObservation && (
                  <div className="text-[10px] text-zinc-600 italic pl-2">Nenhum conteúdo vinculado.</div>
              )}
          </div>
      )}

      {/* --- MODAIS --- */}
      
      <LinkLessonModal 
        isOpen={activeTool === 'LESSON_LINK'}
        onClose={() => setActiveTool(null)}
        courseId={courseId}
        onSave={handleSaveLinkedLessons}
        initialSelectedIds={topic.linkedLessons?.map(l => l.id)}
      />

      {activeTool === 'MAP' && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-in fade-in">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-[#121418]">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2"><BrainCircuit className="text-purple-500" /> Mapa Mental: {topic.name}</h3>
                    <button onClick={() => setActiveTool(null)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-black/50 custom-scrollbar">
                    <MindMapManager nodes={topic.contentData?.mindMap || []} onChange={handleUpdateMindMap} />
                </div>
            </div>
        </div>,
        document.body
      )}

      {activeTool === 'FLASHCARD' && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-in fade-in">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-[#121418]">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2"><Layers className="text-pink-500" /> Flashcards: {topic.name}</h3>
                    <button onClick={() => setActiveTool(null)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-black/50 custom-scrollbar">
                    <FlashcardEditor cards={topic.contentData?.flashcards || []} onChange={handleUpdateFlashcards} />
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (SUBTÓPICO) */}
      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => {
            setIsDeleteModalOpen(false);
            setSubtopicToDelete(null);
        }}
        onConfirm={confirmSubtopicDelete}
        title="Excluir Subtópico?"
        message="Tem certeza que deseja excluir este subtópico? Todo o conteúdo vinculado será perdido."
        confirmText="Excluir"
        variant="danger"
        onCancel={() => {
            setIsDeleteModalOpen(false);
            setSubtopicToDelete(null);
        }}
      />

    </div>
  );
};
