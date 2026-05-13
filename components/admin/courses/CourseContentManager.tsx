import React, { useState, useEffect } from 'react';
import { OnlineCourse, CourseModule } from '../../../types/course';
import { courseService } from '../../../services/courseService';
import { CourseModuleCard } from './modules/CourseModuleCard';
import { CourseModuleModal } from './modules/CourseModuleModal';
import { ModuleContentManager } from './modules/ModuleContentManager';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { AdminCourseEditalManager } from './edital/AdminCourseEditalManager'; // Importando o Gerenciador de Edital
import { AdminCourseStudentsTab } from './AdminCourseStudentsTab'; // Importando a Aba de Alunos
import { Layout, FileText, Users } from 'lucide-react';

interface CourseContentManagerProps {
  course: OnlineCourse;
  onBack: () => void;
}

export function CourseContentManager({ course, onBack }: CourseContentManagerProps) {
  const [activeTab, setActiveTab] = useState<'MODULES' | 'EDITAL' | 'STUDENTS'>('MODULES');

  // --- ESTADOS DE MÓDULOS ---
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [moduleToDelete, setModuleToDelete] = useState<CourseModule | null>(null);
  const [managingModule, setManagingModule] = useState<CourseModule | null>(null);

  // Carregar Módulos
  const loadModules = async () => {
    setLoading(true);
    try {
      const data = await courseService.getModules(course.id);
      setModules(data);
    } catch (error) {
      console.error("Erro ao carregar módulos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'MODULES') {
        loadModules();
    }
  }, [course.id, activeTab]);

  // CRUD Módulos
  const handleSaveModule = async (data: Partial<CourseModule>) => {
    if (editingModule) {
      await courseService.updateModule(editingModule.id, data);
    } else {
      await courseService.createModule({
        ...data,
        courseId: course.id,
        order: 999 
      } as Omit<CourseModule, 'id'>);
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
    [newModules[index], newModules[targetIndex]] = [newModules[targetIndex], newModules[index]];
    setModules(newModules);
    await courseService.reorderModules(newModules);
  };

  const handleManageInternal = (module: CourseModule) => {
    setManagingModule(module);
  };

  if (managingModule) {
    return (
      <ModuleContentManager 
        module={managingModule} 
        onBack={() => setManagingModule(null)} 
      />
    );
  }

  return (
    <div className={`space-y-6 animate-in fade-in flex flex-col ${activeTab === 'MODULES' ? 'h-full' : 'min-h-full'}`}>
      
      {/* Header com Navegação */}
      <div className="flex flex-col gap-4 border-b border-gray-800 pb-4 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
            <span className="text-red-500 font-bold text-xs uppercase tracking-wider">Gerenciando Curso</span>
            <h2 className="text-2xl font-black text-white uppercase">{course.title}</h2>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 w-fit">
              <button 
                  onClick={() => setActiveTab('MODULES')}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase flex items-center gap-2 transition-all ${activeTab === 'MODULES' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Layout size={14} /> Módulos e Aulas
              </button>
              <button 
                  onClick={() => setActiveTab('EDITAL')}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase flex items-center gap-2 transition-all ${activeTab === 'EDITAL' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <FileText size={14} /> Edital Verticalizado
              </button>
              <button 
                  onClick={() => setActiveTab('STUDENTS')}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase flex items-center gap-2 transition-all ${activeTab === 'STUDENTS' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Users size={14} /> Alunos
              </button>
          </div>
      </div>

      {/* Conteúdo da Aba */}
      <div className={`flex-1 ${activeTab === 'MODULES' ? 'overflow-hidden' : ''}`}>
          {activeTab === 'EDITAL' ? (
              <AdminCourseEditalManager courseId={course.id} />
          ) : activeTab === 'STUDENTS' ? (
              <AdminCourseStudentsTab courseId={course.id} />
          ) : (
             <div className="space-y-6 h-full overflow-y-auto custom-scrollbar p-1">
                <div className="flex justify-end">
                    <button 
                    onClick={() => { setEditingModule(null); setIsModuleModalOpen(true); }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded shadow-lg shadow-red-900/20 flex items-center gap-2"
                    >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Novo Módulo
                    </button>
                </div>

                {loading ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div></div>
                ) : modules.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl">
                    <p className="text-gray-500">Nenhum módulo cadastrado neste curso.</p>
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
                        onManageContent={handleManageInternal}
                        isFirst={index === 0}
                        isLast={index === modules.length - 1}
                    />
                    ))}
                </div>
                )}
             </div>
          )}
      </div>

      {/* Modais (Apenas para Módulos) */}
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