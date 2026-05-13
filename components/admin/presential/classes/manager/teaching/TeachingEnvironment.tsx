import React, { useState, useEffect } from 'react';
import { CourseModule } from '../../../../../../types/course';
import { courseService } from '../../../../../../services/courseService';
import { CourseModuleCard } from '../../../../courses/modules/CourseModuleCard';
import { CourseModuleModal } from '../../../../courses/modules/CourseModuleModal';
import { ModuleContentManager } from '../../../../courses/modules/ModuleContentManager';
import { ConfirmationModal } from '../../../../ui/ConfirmationModal';

interface TeachingEnvironmentProps {
  classId: string;
}

export function TeachingEnvironment({ classId }: TeachingEnvironmentProps) {
  // --- ESTADOS DE MÓDULOS ---
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [moduleToDelete, setModuleToDelete] = useState<CourseModule | null>(null);
  
  // Estado para controlar se o usuário está vendo a lista ou o conteúdo de um módulo
  // Armazena o objeto completo do módulo selecionado
  const [selectedModule, setSelectedModule] = useState<CourseModule | null>(null);

  // Carregar Módulos
  const loadModules = async () => {
    setLoading(true);
    try {
      // Polimorfismo: Usamos classId como se fosse courseId
      const data = await courseService.getModules(classId);
      setModules(data);
    } catch (error) {
      console.error("Erro ao carregar módulos da turma:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, [classId]);

  // CRUD Módulos
  const handleSaveModule = async (data: Partial<CourseModule>) => {
    if (editingModule) {
      await courseService.updateModule(editingModule.id, data);
    } else {
      await courseService.createModule({
        ...data,
        courseId: classId, // Polimorfismo: Salvamos com o ID da turma
        order: 999 
      } as any);
    }
    await loadModules();
    setEditingModule(null);
  };

  const handleDeleteModule = async () => {
    if (moduleToDelete) {
      await courseService.deleteModule(moduleToDelete.id);
      await loadModules();
      setModuleToDelete(null);
    }
  };

  const handleReorder = async (index: number, direction: 'left' | 'right') => {
    const newModules = [...modules];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModules.length) return;
    
    [newModules[index], newModules[targetIndex]] = [newModules[targetIndex], newModules[index]];
    setModules(newModules);
    await courseService.reorderModules(newModules);
  };

  // Se um módulo estiver selecionado, renderiza o gerenciador de conteúdo interno
  if (selectedModule) {
    return (
      <ModuleContentManager 
        module={selectedModule} 
        onBack={() => setSelectedModule(null)} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in flex flex-col h-full">
      
      {/* Header com Título e Botão Novo Módulo */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 shrink-0">
          <div>
            <span className="text-red-500 font-bold text-xs uppercase tracking-wider">Turma Presencial</span>
            <h2 className="text-2xl font-black text-white uppercase">Ambiente de Ensino (Recursos Online)</h2>
          </div>

          <button 
            onClick={() => { setEditingModule(null); setIsModuleModalOpen(true); }}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded shadow-lg shadow-red-900/20 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Novo Módulo
          </button>
      </div>

      {/* Lista de Módulos */}
      <div className="flex-1 overflow-hidden">
         <div className="space-y-6 h-full overflow-y-auto custom-scrollbar p-1">
            {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div></div>
            ) : modules.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl">
                <p className="text-gray-500">Nenhum módulo cadastrado nesta turma.</p>
                <button 
                    onClick={() => { setEditingModule(null); setIsModuleModalOpen(true); }}
                    className="mt-4 text-red-500 hover:text-red-400 text-sm font-bold uppercase"
                >
                    Criar Primeiro Módulo
                </button>
            </div>
            ) : (
            <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-transparent px-1">
                {modules.map((module, index) => (
                <CourseModuleCard 
                    key={module.id}
                    module={module}
                    onEdit={(m) => { setEditingModule(m); setIsModuleModalOpen(true); }}
                    onDelete={setModuleToDelete}
                    onMoveLeft={() => { handleReorder(index, 'left'); }}
                    onMoveRight={() => { handleReorder(index, 'right'); }}
                    onManageContent={(m) => setSelectedModule(m)}
                    isFirst={index === 0}
                    isLast={index === modules.length - 1}
                />
                ))}
            </div>
            )}
         </div>
      </div>

      {/* Modais */}
      <CourseModuleModal 
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        onSave={handleSaveModule}
        initialData={editingModule}
      />

      <ConfirmationModal 
        isOpen={!!moduleToDelete}
        title="Excluir Módulo?"
        message={`Deseja excluir "${moduleToDelete?.title}"? Todo o conteúdo interno será perdido.`}
        onConfirm={handleDeleteModule}
        onCancel={() => setModuleToDelete(null)}
        isDanger
      />
    </div>
  );
}
