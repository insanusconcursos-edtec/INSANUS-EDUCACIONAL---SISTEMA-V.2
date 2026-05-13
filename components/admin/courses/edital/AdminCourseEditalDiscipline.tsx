
import React, { useState } from 'react';
import { ChevronRight, Plus, Trash2, BookOpen, ArrowUp, ArrowDown } from 'lucide-react';
import { CourseEditalDiscipline, CourseEditalTopic } from '../../../../types/courseEdital';
import { AdminCourseEditalTopic } from './AdminCourseEditalTopic';
import { ConfirmationModal } from '../../ui/ConfirmationModal';

interface Props {
  discipline: CourseEditalDiscipline;
  courseId: string;
  onUpdate: (updated: CourseEditalDiscipline) => void;
  onDelete: () => void;
  // Props de reordenação recebidas do pai (Manager)
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const AdminCourseEditalDiscipline: React.FC<Props> = ({ 
    discipline, courseId, onUpdate, onDelete, 
    onMoveUp, onMoveDown, isFirst, isLast 
}) => {
  const [isOpen, setIsOpen] = useState(false); // Padrão fechado para melhor organização visual
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(discipline.name);

  // Estados para Modal de Exclusão de Tópico
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);

  // Handlers de Edição de Nome
  const handleNameBlur = () => {
    setIsEditingName(false);
    if (localName !== discipline.name) {
        onUpdate({ ...discipline, name: localName });
    }
  };

  // Adicionar Novo Tópico
  const handleAddTopic = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newTopic: CourseEditalTopic = {
        id: generateId(),
        name: 'Novo Tópico',
        subtopics: [],
        linkedLessons: [],
        materialPdfs: [],
        contentData: { mindMap: [], flashcards: [] }
    };
    onUpdate({
        ...discipline,
        topics: [...discipline.topics, newTopic]
    });
    setIsOpen(true); // Abre a pasta ao adicionar
  };

  // Atualizar Tópico
  const handleTopicUpdate = (updatedTopic: CourseEditalTopic) => {
    onUpdate({
        ...discipline,
        topics: discipline.topics.map(t => t.id === updatedTopic.id ? updatedTopic : t)
    });
  };

  // Solicitar Exclusão de Tópico (Abre Modal)
  const handleDeleteRequest = (topicId: string) => {
    setTopicToDelete(topicId);
    setIsDeleteModalOpen(true);
  };

  // Confirmar Exclusão de Tópico
  const confirmDeleteTopic = () => {
    if (topicToDelete) {
        onUpdate({
            ...discipline,
            topics: discipline.topics.filter(t => t.id !== topicToDelete)
        });
        setIsDeleteModalOpen(false);
        setTopicToDelete(null);
    }
  };

  // --- REORDENAÇÃO DE TÓPICOS (Lógica Interna) ---
  const handleMoveTopic = (index: number, direction: 'up' | 'down') => {
      const topics = discipline.topics || [];
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === topics.length - 1)) return;

      const newTopics = [...topics];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      // Swap
      [newTopics[index], newTopics[targetIndex]] = [newTopics[targetIndex], newTopics[index]];

      onUpdate({ ...discipline, topics: newTopics });
  };

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-[#15171b] mb-3 transition-all hover:border-zinc-700 shadow-sm">
      {/* Header (Clicável para Acordeão) */}
      <div 
        className={`flex items-center justify-between p-4 cursor-pointer group select-none transition-colors ${isOpen ? 'bg-[#1a1d24]' : 'hover:bg-[#1a1d24]'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 flex-1">
            <div className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                <ChevronRight size={18} />
            </div>
            
            <div className="p-2 bg-red-600/10 rounded-lg border border-red-600/20 text-red-500">
                <BookOpen size={16} />
            </div>
            
            {isEditingName ? (
                <input 
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleNameBlur}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="bg-black border border-zinc-700 rounded px-2 py-1 text-white text-sm font-bold uppercase w-64 focus:outline-none focus:border-red-500"
                />
            ) : (
                <span 
                    className="text-white font-bold uppercase text-sm hover:text-red-400 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setIsEditingName(true); }}
                    title="Clique para editar nome"
                >
                    {discipline.name}
                </span>
            )}
            
            <span className="text-[10px] text-zinc-500 font-mono bg-black/30 px-2 py-0.5 rounded border border-zinc-800 ml-2">
                {discipline.topics.length} Tópicos
            </span>
        </div>

        <div className="flex items-center gap-2">
            
            {/* Controles de Movimentação da Disciplina (Pai) */}
            <div className="flex items-center bg-black/40 rounded border border-zinc-800 mr-2" onClick={e => e.stopPropagation()}>
                <button 
                    onClick={onMoveUp} 
                    disabled={isFirst}
                    className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-l disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Mover Disciplina para Cima"
                >
                    <ArrowUp size={12} />
                </button>
                <div className="w-px h-4 bg-zinc-800"></div>
                <button 
                    onClick={onMoveDown} 
                    disabled={isLast}
                    className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-r disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Mover Disciplina para Baixo"
                >
                    <ArrowDown size={12} />
                </button>
            </div>

            <button 
                onClick={handleAddTopic}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold flex items-center gap-1 border border-zinc-700 uppercase transition-all"
            >
                <Plus size={12} /> Tópico
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                title="Excluir Disciplina"
            >
                <Trash2 size={16} />
            </button>
        </div>
      </div>

      {/* Body (Lista de Tópicos) */}
      {isOpen && (
        <div className="bg-black/20 p-2 pl-4 border-t border-zinc-800 space-y-2 animate-in slide-in-from-top-2 duration-200">
            {discipline.topics.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-xs italic">
                    Nenhum tópico cadastrado. Adicione um acima.
                </div>
            ) : (
                discipline.topics.map((topic, index) => (
                    <AdminCourseEditalTopic 
                        key={topic.id}
                        topic={topic}
                        courseId={courseId}
                        onUpdate={handleTopicUpdate}
                        // Passamos a função de solicitação de exclusão
                        onDelete={() => handleDeleteRequest(topic.id)}
                        // Passando função de reordenação para o filho
                        onMoveUp={() => handleMoveTopic(index, 'up')}
                        onMoveDown={() => handleMoveTopic(index, 'down')}
                        isFirst={index === 0}
                        isLast={index === discipline.topics.length - 1}
                    />
                ))
            )}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onConfirm={confirmDeleteTopic}
        title="Excluir Tópico?"
        message="Tem certeza que deseja excluir este tópico? Todos os subtópicos e materiais vinculados serão perdidos."
        confirmText="Excluir"
        isDanger={true}
        onCancel={() => {
            setIsDeleteModalOpen(false);
            setTopicToDelete(null);
        }}
      />
    </div>
  );
};
