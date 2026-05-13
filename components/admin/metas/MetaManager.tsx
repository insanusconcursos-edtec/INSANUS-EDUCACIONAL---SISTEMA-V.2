
import React, { useEffect, useState } from 'react';
import { ArrowLeft, PlayCircle, FileText, ListChecks, Book, Edit3, RefreshCw, Target } from 'lucide-react';
import { Topic, Discipline } from '../../../services/structureService';
import { Meta, MetaType, getMetas, addMeta, deleteMeta, reorderMetasBatch, updateMeta } from '../../../services/metaService';
import MetaItem from './MetaItem';
import LessonForm from './forms/LessonForm';
import MaterialForm from './forms/MaterialForm';
import QuestionsForm from './forms/QuestionsForm';
import LawForm from './forms/LawForm';
import SummaryForm from './forms/SummaryForm';
import ReviewForm from './forms/ReviewForm';
import ConfirmationModal from '../../ui/ConfirmationModal';

interface MetaManagerProps {
  planId: string;
  discipline: Discipline;
  topic: Topic;
  onBack: () => void;
}

const MetaManager: React.FC<MetaManagerProps> = ({ planId, discipline, topic, onBack }) => {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Forms State
  const [activeForm, setActiveForm] = useState<MetaType | null>(null);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [metaToDelete, setMetaToDelete] = useState<Meta | null>(null);

  // IDs helper
  const ids = { planId, discId: discipline.id!, topicId: topic.id! };

  useEffect(() => {
    fetchMetas();
  }, [topic.id]);

  const fetchMetas = async () => {
    setLoading(true);
    try {
      const data = await getMetas(ids.planId, ids.discId, ids.topicId);
      setMetas(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (type: MetaType, metaToEdit?: Meta) => {
    setEditingMeta(metaToEdit || null);
    setActiveForm(type);
  };

  const handleSaveMeta = async (data: any) => {
    setSubmitting(true);
    try {
      if (editingMeta && editingMeta.id) {
        await updateMeta(ids, editingMeta.id, data);
      } else {
        await addMeta(ids, data);
      }
      await fetchMetas();
      setActiveForm(null);
      setEditingMeta(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar meta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = (meta: Meta) => setMetaToDelete(meta);

  const confirmDelete = async () => {
    if (!metaToDelete?.id) return;
    try {
      await deleteMeta(ids, metaToDelete.id);
      setMetas(metas.filter(m => m.id !== metaToDelete.id));
      setMetaToDelete(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    // 1. Cópia local para manipulação
    const newMetas = [...metas];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newMetas.length) return;
    
    // 2. Troca de posições no array
    [newMetas[index], newMetas[targetIndex]] = [newMetas[targetIndex], newMetas[index]];
    
    // 3. Reindexação local (Visual Consistency)
    // Garante que o atributo 'order' reflita o índice 0, 1, 2...
    const reorderedMetas = newMetas.map((m, idx) => ({ ...m, order: idx }));
    setMetas(reorderedMetas);

    // 4. Persistência em Lote (Batch Update)
    try {
      await reorderMetasBatch(ids, reorderedMetas);
    } catch (error) {
      console.error("Erro ao reordenar metas:", error);
      fetchMetas(); // Reverte em caso de erro
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col h-[calc(100vh-200px)] overflow-hidden animate-in fade-in slide-in-from-right-8 duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex items-center gap-4">
        <button 
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
            <ArrowLeft size={16} />
        </button>
        <div>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-black text-brand-red tracking-widest border border-brand-red/30 px-1.5 rounded">{discipline.name}</span>
            </div>
            <h3 className="text-sm font-black text-white tracking-tighter flex items-center gap-2">
                <Target size={16} className="text-zinc-500" />
                {topic.name}
            </h3>
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-3 bg-zinc-950 border-b border-zinc-800 grid grid-cols-3 sm:grid-cols-6 gap-2">
         {[
           { label: 'AULA', type: 'lesson', icon: <PlayCircle size={14} />, color: 'hover:border-blue-500 hover:text-blue-500' },
           { label: 'MATERIAL', type: 'material', icon: <FileText size={14} />, color: 'hover:border-orange-500 hover:text-orange-500' },
           { label: 'QUESTÕES', type: 'questions', icon: <ListChecks size={14} />, color: 'hover:border-green-500 hover:text-green-500' },
           { label: 'LEI SECA', type: 'law', icon: <Book size={14} />, color: 'hover:border-yellow-500 hover:text-yellow-500' },
           { label: 'RESUMO', type: 'summary', icon: <Edit3 size={14} />, color: 'hover:border-purple-500 hover:text-purple-500' },
           { label: 'FLASHCARD', type: 'review', icon: <RefreshCw size={14} />, color: 'hover:border-pink-500 hover:text-pink-500' },
         ].map((btn) => (
           <button
             key={btn.label}
             onClick={() => handleOpenForm(btn.type as MetaType)}
             className={`flex flex-col items-center justify-center gap-1 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-500 transition-all ${btn.color}`}
           >
             {btn.icon}
             <span className="text-[9px] font-bold tracking-tighter">{btn.label}</span>
           </button>
         ))}
      </div>

      {/* Metas List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-zinc-900/30">
        {loading ? (
             <div className="flex justify-center py-10"><div className="animate-spin h-6 w-6 border-2 border-brand-red rounded-full border-t-transparent"></div></div>
        ) : metas.length === 0 ? (
             <div className="text-center py-20 opacity-50 flex flex-col items-center gap-3">
                <Target size={32} className="text-zinc-700" />
                <span className="text-[10px] font-bold text-zinc-600">Cadastre as metas deste assunto</span>
             </div>
        ) : (
             metas.map((meta, index) => (
                <MetaItem 
                    key={meta.id} 
                    meta={meta}
                    onEdit={(m) => handleOpenForm(m.type, m)}
                    onDelete={handleDeleteRequest}
                    onMove={(dir) => handleMove(index, dir)}
                    isFirst={index === 0}
                    isLast={index === metas.length - 1}
                />
             ))
        )}
      </div>

      {/* Modals */}
      <LessonForm 
        isOpen={activeForm === 'lesson'}
        onClose={() => setActiveForm(null)}
        onSave={handleSaveMeta}
        initialData={editingMeta}
        loading={submitting}
      />

      <MaterialForm
        isOpen={activeForm === 'material'}
        onClose={() => setActiveForm(null)}
        onSave={handleSaveMeta}
        initialData={editingMeta}
        loading={submitting}
        planId={planId}
      />

      <QuestionsForm
        isOpen={activeForm === 'questions'}
        onClose={() => setActiveForm(null)}
        onSave={handleSaveMeta}
        initialData={editingMeta}
        loading={submitting}
        planId={planId}
      />

      <LawForm
        isOpen={activeForm === 'law'}
        onClose={() => setActiveForm(null)}
        onSave={handleSaveMeta}
        initialData={editingMeta}
        loading={submitting}
        planId={planId}
      />
      
      <SummaryForm 
        isOpen={activeForm === 'summary'}
        onClose={() => setActiveForm(null)}
        onSave={handleSaveMeta}
        initialData={editingMeta}
        loading={submitting}
        planId={planId}
        otherMetas={metas.filter(m => m.id !== editingMeta?.id)}
      />

      <ReviewForm
        isOpen={activeForm === 'review'}
        onClose={() => setActiveForm(null)}
        onSave={handleSaveMeta}
        initialData={editingMeta}
        loading={submitting}
        planId={planId}
      />

      <ConfirmationModal 
        isOpen={!!metaToDelete}
        onClose={() => setMetaToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Meta"
        message="Deseja remover esta meta do plano?"
      />
    </div>
  );
};

export default MetaManager;
