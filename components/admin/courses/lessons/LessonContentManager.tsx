import React, { useState, useEffect } from 'react';
import { CourseLesson, CourseContent } from '../../../../types/course';
import { courseService } from '../../../../services/courseService';
import { ContentItem } from './items/ContentItem';
import { ContentModal } from './modals/ContentModal';
import { ConfirmationModal } from '../../ui/ConfirmationModal';

interface LessonContentManagerProps {
  lesson: CourseLesson;
  onBack: () => void;
}

export function LessonContentManager({ lesson, onBack }: LessonContentManagerProps) {
  const [contents, setContents] = useState<CourseContent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<CourseContent | null>(null);
  const [contentToDelete, setContentToDelete] = useState<CourseContent | null>(null);

  const loadContents = async () => {
    setLoading(true);
    try {
      const data = await courseService.getContents(lesson.id);
      setContents(data);
    } catch (error) {
      console.error("Erro ao carregar conteúdos", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContents();
  }, [lesson.id]);

  const handleSave = async (data: Partial<CourseContent>) => {
    if (editingContent) {
      await courseService.updateContent(editingContent.id, data);
    } else {
      await courseService.createContent({ ...data, lessonId: lesson.id } as Omit<CourseContent, 'id'>);
    }
    await loadContents();
    setEditingContent(null);
  };

  const handleDelete = async () => {
    if (contentToDelete) {
      await courseService.deleteContent(contentToDelete.id);
      await loadContents();
      setContentToDelete(null);
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const newContents = [...contents];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newContents[index], newContents[targetIndex]] = [newContents[targetIndex], newContents[index]];
    
    // Check rule and update linkage based on new position
    newContents.forEach((item, i) => {
        if (item.isLinkedToPreviousTheory) {
            // Se mudou de tipo ou classificação, remove vínculo
            if (item.type !== 'pdf' || item.pdfClassification !== 'QUESTÕES') {
                item.isLinkedToPreviousTheory = false;
                item.linkedTheoryId = null;
                return;
            }

            // Busca reversa pela teoria mais próxima
            let foundTheoryId = null;
            for (let j = i - 1; j >= 0; j--) {
                const prev = newContents[j];
                if (prev.pdfClassification === 'TEORIA' || prev.pdfClassification === 'TEORIA_QUESTÕES') {
                    foundTheoryId = prev.id;
                    break;
                }
            }

            if (foundTheoryId) {
                item.linkedTheoryId = foundTheoryId;
            } else {
                // Se não achou nenhuma teoria antes, desmarca
                item.isLinkedToPreviousTheory = false;
                item.linkedTheoryId = null;
            }
        } else {
            item.linkedTheoryId = null;
        }
    });
    
    setContents(newContents);
    await courseService.reorderContents(newContents);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-gray-800 pb-6">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Gerenciando Aula</span>
          <h2 className="text-xl font-black text-white uppercase">{lesson.title}</h2>
        </div>
        <div className="flex-1"></div>
        <button 
          onClick={() => { setEditingContent(null); setIsModalOpen(true); }}
          className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded shadow-lg shadow-red-900/20 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Adicionar Conteúdo
        </button>
      </div>

      {/* Lista */}
      <div className="max-w-3xl mx-auto space-y-2">
        {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div></div>
        ) : contents.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl bg-[#121418]">
                <p className="text-gray-500">Nenhum conteúdo adicionado a esta aula.</p>
            </div>
        ) : (
            contents.map((item, index) => (
                <ContentItem 
                    key={item.id}
                    content={item}
                    onEdit={() => { setEditingContent(item); setIsModalOpen(true); }}
                    onDelete={() => setContentToDelete(item)}
                    onMoveUp={() => handleReorder(index, 'up')}
                    onMoveDown={() => handleReorder(index, 'down')}
                    isFirst={index === 0}
                    isLast={index === contents.length - 1}
                />
            ))
        )}
      </div>

      {/* Modais */}
      <ContentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingContent}
        lessonId={lesson.id}
        contents={contents}
      />

      <ConfirmationModal 
        isOpen={!!contentToDelete}
        title="Excluir Conteúdo?"
        message={`Deseja excluir "${contentToDelete?.title}"?`}
        onConfirm={handleDelete}
        onCancel={() => setContentToDelete(null)}
        isDanger
      />
    </div>
  );
}