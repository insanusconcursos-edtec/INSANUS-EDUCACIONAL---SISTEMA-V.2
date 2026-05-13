
import React, { useState, useEffect } from 'react';
import { MentorshipSection, MentorshipModule } from '../../../../types/mentorship';
import { mentorshipService } from '../../../../services/mentorshipService';
import { MentorshipModuleModal } from './MentorshipModuleModal';
import { MentorshipModuleDetail } from './MentorshipModuleDetail';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { GripVertical } from 'lucide-react';

// DnD Kit Imports
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Função auxiliar simples para gerar ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

interface PlanMentorshipTabProps {
  planId: string;
}

// --- COMPONENTE DE CARD ARRASTÁVEL ---
interface SortableModuleCardProps {
  mod: MentorshipModule;
  sectionId: string;
  onEnter: (mod: MentorshipModule) => void;
  onEdit: (e: React.MouseEvent, mod: MentorshipModule, sectionId: string) => void;
  onDelete: (e: React.MouseEvent, moduleId: string, sectionId: string) => void;
}

function SortableModuleCard({ mod, sectionId, onEnter, onEdit, onDelete }: SortableModuleCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: mod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
        ref={setNodeRef}
        style={style}
        className={`relative group bg-[#1a1d24] rounded-lg overflow-hidden border transition-all ${isDragging ? 'opacity-50 scale-105 shadow-2xl z-50 border-[var(--plan-theme,red)] cursor-grabbing' : 'border-gray-700 hover:border-[var(--plan-theme,red)] cursor-pointer transform hover:-translate-y-1 hover:shadow-xl'}`}
    >
        {/* Grip Handle */}
        <div 
          {...attributes} 
          {...listeners}
          className="absolute top-2 left-2 z-30 p-1.5 bg-black/60 text-white rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div onClick={() => !isDragging && onEnter(mod)}>
            {/* Botões de Ação do Módulo (Visíveis no Hover) */}
            <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(e, mod, sectionId); }}
                    className="p-1.5 bg-black/80 text-white rounded hover:bg-blue-600 transition-colors backdrop-blur-sm shadow-md"
                    title="Editar Módulo"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(e, mod.id, sectionId); }}
                    className="p-1.5 bg-black/80 text-white rounded hover:bg-red-600 transition-colors backdrop-blur-sm shadow-md"
                    title="Excluir Módulo"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>

            <div className="aspect-[474/1000] bg-black relative">
                <img src={mod.coverUrl} alt={mod.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                
                {/* Status de Bloqueio */}
                {mod.isLocked && (
                    <div className="absolute top-2 left-10 z-20 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm uppercase tracking-wide flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Bloqueado
                    </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h4 className="text-white font-bold text-lg leading-tight drop-shadow-md">{mod.title}</h4>
                    <p className="text-gray-400 text-xs mt-1">{mod.lessons?.length || 0} aulas</p>
                </div>
                {/* Overlay de Gerenciar (Só texto) */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-white font-bold uppercase text-xs border border-white px-3 py-1 rounded">Gerenciar</span>
                </div>
            </div>
        </div>
    </div>
  );
}

export function PlanMentorshipTab({ planId }: PlanMentorshipTabProps) {
  // --- ESTADOS GERAIS ---
  const [sections, setSections] = useState<MentorshipSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activeModule, setActiveModule] = useState<MentorshipModule | null>(null);

  // --- ESTADOS DE CRIAÇÃO/EDIÇÃO SEÇÃO ---
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editTitleTemp, setEditTitleTemp] = useState('');
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);

  // --- ESTADOS DE MÓDULO (NOVO + EDIÇÃO + EXCLUSÃO) ---
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [moduleToEdit, setModuleToEdit] = useState<MentorshipModule | null>(null); // Módulo sendo editado
  const [moduleToDelete, setModuleToDelete] = useState<{modId: string, secId: string} | null>(null); // Módulo para deletar

  // --- CONFIGURAÇÃO DND-KIT ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (planId) loadData();
  }, [planId]);

  const handleDragEndModules = async (event: DragEndEvent, sectionId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) return;

    const currentSection = sections[sectionIndex];
    const oldIndex = currentSection.modules.findIndex(m => m.id === active.id);
    const newIndex = currentSection.modules.findIndex(m => m.id === over.id);

    const newModules = arrayMove(currentSection.modules, oldIndex, newIndex).map((mod, idx) => ({
      ...mod,
      order: idx
    }));

    const updatedSections = [...sections];
    updatedSections[sectionIndex] = { ...currentSection, modules: newModules };

    setSections(updatedSections);
    await saveChanges(updatedSections);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await mentorshipService.getMentorship(planId);
      if (data && data.sections) {
        setSections(data.sections);
        // Expande tudo por padrão
        const initialExpandedState: Record<string, boolean> = {};
        data.sections.forEach(s => { initialExpandedState[s.id] = true; });
        setExpandedSections(initialExpandedState);
      } else {
        setSections([]);
      }
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = async (updatedData: MentorshipSection[]) => {
    try {
      await mentorshipService.saveMentorship(planId, updatedData);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  // --- LÓGICA DE SEÇÃO ---
  const toggleSection = (sectionId: string) => {
    if (editingSectionId === sectionId) return;
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return alert("Digite um nome para a seção.");
    const newId = generateId();
    const newSection: MentorshipSection = {
      id: newId,
      title: newSectionTitle,
      modules: [],
      order: sections.length
    };
    const updatedSections = [...sections, newSection];
    setSections(updatedSections);
    setExpandedSections(prev => ({...prev, [newId]: true}));
    setNewSectionTitle('');
    await saveChanges(updatedSections);
  };

  const startEditing = (e: React.MouseEvent, section: MentorshipSection) => {
    e.stopPropagation();
    setEditingSectionId(section.id);
    setEditTitleTemp(section.title);
  };

  const saveSectionTitle = async (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation();
    if (!editTitleTemp.trim()) return;
    const updatedSections = sections.map(s => s.id === sectionId ? { ...s, title: editTitleTemp } : s);
    setSections(updatedSections);
    setEditingSectionId(null);
    await saveChanges(updatedSections);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSectionId(null);
    setEditTitleTemp('');
  };

  const confirmDeleteSection = (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation();
    setSectionToDelete(sectionId);
  };

  const executeDeleteSection = () => {
    if (sectionToDelete) {
      const updated = sections.filter(s => s.id !== sectionToDelete);
      setSections(updated);
      saveChanges(updated);
      setSectionToDelete(null);
    }
  };

  // --- LÓGICA DE MÓDULOS ---
  
  // 1. Abrir Modal de CRIAÇÃO
  const openAddModuleModal = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setModuleToEdit(null); // Garante modo criação
    setIsModuleModalOpen(true);
  };

  // 2. Abrir Modal de EDIÇÃO
  const openEditModuleModal = (e: React.MouseEvent | null, module: MentorshipModule, sectionId: string) => {
    if (e) e.stopPropagation(); // Impede entrar no módulo se clicado na lista
    setSelectedSectionId(sectionId);
    setModuleToEdit(module);
    setIsModuleModalOpen(true);
  };

  // 3. Salvar (Criar ou Editar)
  const handleSaveModule = async (title: string, coverFile: File | null, isLocked: boolean, releaseDate: string) => {
    if (!selectedSectionId) return;
    setIsSaving(true);

    try {
      let updatedSections = [...sections];

      // Cenário A: EDIÇÃO
      if (moduleToEdit) {
        let newCoverUrl = moduleToEdit.coverUrl;
        
        // Se enviou nova imagem, faz upload
        if (coverFile) {
            newCoverUrl = await mentorshipService.uploadModuleCover(coverFile, planId);
        }

        updatedSections = sections.map(section => {
          if (section.id === selectedSectionId) {
            return {
              ...section,
              modules: section.modules.map(m => 
                m.id === moduleToEdit.id 
                  ? { ...m, title, coverUrl: newCoverUrl, isLocked, releaseDate }
                  : m
              )
            };
          }
          return section;
        });

        // ATUALIZAÇÃO OTIMISTA DO MÓDULO ATIVO (Se estiver aberto)
        if (activeModule && activeModule.id === moduleToEdit.id) {
           const updatedSection = updatedSections.find(s => s.id === selectedSectionId);
           const updatedMod = updatedSection?.modules.find(m => m.id === moduleToEdit.id);
           if (updatedMod) {
               setActiveModule(updatedMod);
           }
        }

      } 
      // Cenário B: CRIAÇÃO
      else {
        if (!coverFile) return; // Deveria ser barrado no modal, mas garantindo
        const coverUrl = await mentorshipService.uploadModuleCover(coverFile, planId);
        
        const newModule: MentorshipModule = {
          id: generateId(),
          title,
          coverUrl,
          lessons: [],
          subModules: [],
          order: Date.now(),
          isLocked,
          releaseDate
        };

        updatedSections = sections.map(section => {
            if (section.id === selectedSectionId) {
              return { ...section, modules: [...section.modules, newModule] };
            }
            return section;
        });
      }

      setSections(updatedSections);
      await mentorshipService.saveMentorship(planId, updatedSections);
      
      setIsModuleModalOpen(false);
      setModuleToEdit(null);
      // Garante seção aberta
      setExpandedSections(prev => ({...prev, [selectedSectionId]: true}));

    } catch (error) {
      console.error(error);
      alert('Erro ao salvar módulo.');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Iniciar Exclusão de Módulo
  const handleConfirmDeleteModule = (e: React.MouseEvent, moduleId: string, sectionId: string) => {
    e.stopPropagation();
    setModuleToDelete({ modId: moduleId, secId: sectionId });
  };

  // 5. Executar Exclusão de Módulo
  const executeDeleteModule = () => {
    if (!moduleToDelete) return;
    
    const updatedSections = sections.map(section => {
        if (section.id === moduleToDelete.secId) {
            return {
                ...section,
                modules: section.modules.filter(m => m.id !== moduleToDelete.modId)
            };
        }
        return section;
    });

    setSections(updatedSections);
    saveChanges(updatedSections);
    setModuleToDelete(null);
  };


  const handleEnterModule = (module: MentorshipModule) => {
    setActiveModule(module);
  };

  const handleBackToSections = () => {
    setActiveModule(null);
    loadData(); 
  };

  // --- HANDLER PARA ABRIR EDIÇÃO A PARTIR DA TELA DE DETALHE ---
  const handleEditActiveModule = () => {
    if (!activeModule) return;
    // Encontra a seção a qual este módulo pertence
    const section = sections.find(s => s.modules.some(m => m.id === activeModule.id));
    if (section) {
        openEditModuleModal(null, activeModule, section.id);
    }
  };

  if (loading) return <div className="text-white p-8 animate-pulse">Carregando mentoria...</div>;

  // --- RENDERIZAÇÃO: DETALHES DO MÓDULO ---
  if (activeModule) {
    return (
      <MentorshipModuleDetail 
        planId={planId}
        module={activeModule}
        onBack={handleBackToSections}
        onEdit={handleEditActiveModule} // Passa o handler para o filho
        onUpdateModule={async (updatedModule) => {
            const updatedSections = sections.map(section => ({
                ...section,
                modules: section.modules.map(m => m.id === updatedModule.id ? updatedModule : m)
            }));
            setSections(updatedSections);
            await saveChanges(updatedSections);
            setActiveModule(updatedModule);
        }}
      />
    );
  }

  // --- RENDERIZAÇÃO: LISTA DE SEÇÕES ---
  return (
    <div className="flex flex-col h-full bg-[#0f1115] p-6 rounded-b-xl animate-in fade-in overflow-y-auto custom-scrollbar">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white">Mentoria e Módulos</h2>
          <p className="text-gray-400 text-sm mt-1">Organize seu conteúdo didático.</p>
        </div>
        {isSaving && <span className="text-yellow-500 text-xs font-bold uppercase animate-pulse">Salvando...</span>}
      </div>

      {/* Criar Seção */}
      <div className="bg-[#1a1d24] p-6 rounded-xl border border-gray-800 mb-8 shadow-lg shrink-0">
        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Nova Seção</label>
        <div className="flex gap-3">
          <input 
            type="text" 
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
            placeholder="Ex: Módulos Iniciais..."
            className="flex-1 bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:outline-none"
          />
          <button 
            onClick={handleAddSection}
            disabled={isSaving}
            className="bg-white text-black px-8 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors uppercase text-sm"
          >
            + Criar Seção
          </button>
        </div>
      </div>

      {/* Lista de Seções */}
      <div className="space-y-4 pb-20">
        {sections.map((section) => {
            const isOpen = expandedSections[section.id];
            const isEditing = editingSectionId === section.id;

            return (
              <div key={section.id} className={`border rounded-xl overflow-hidden transition-all ${isEditing ? 'border-red-500 bg-[#1a1d24]' : 'border-gray-800 bg-black/40'}`}>
                
                {/* Header da Seção */}
                <div 
                    onClick={() => toggleSection(section.id)}
                    className="bg-[#121418] p-4 flex justify-between items-center border-b border-gray-800 cursor-pointer hover:bg-[#1a1d24] transition-colors group select-none min-h-[70px]"
                >
                  <div className="flex items-center gap-4 flex-1">
                      {/* Chevron */}
                      {!isEditing && (
                        <div className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                      )}

                      <div className="flex items-center gap-3 flex-1">
                          {!isEditing && <div className={`w-1 h-6 rounded-full transition-colors ${isOpen ? 'bg-red-600' : 'bg-gray-700'}`}></div>}
                          
                          {/* MODO EDIÇÃO VS VISUALIZAÇÃO */}
                          {isEditing ? (
                              <div className="flex items-center gap-2 w-full max-w-md animate-in fade-in" onClick={e => e.stopPropagation()}>
                                  <input 
                                    type="text"
                                    value={editTitleTemp}
                                    onChange={(e) => setEditTitleTemp(e.target.value)}
                                    className="flex-1 bg-black border border-gray-600 rounded px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                                    autoFocus
                                  />
                                  <button onClick={(e) => saveSectionTitle(e, section.id)} className="p-2 bg-green-600 hover:bg-green-500 rounded text-white" title="Salvar">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  </button>
                                  <button onClick={cancelEditing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300" title="Cancelar">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                              </div>
                          ) : (
                              <>
                                <h3 className={`text-lg font-bold uppercase tracking-wider transition-colors ${isOpen ? 'text-white' : 'text-gray-400'}`}>
                                    {section.title}
                                </h3>
                                <span className="text-xs text-gray-600 font-mono bg-gray-900 px-2 py-0.5 rounded">
                                    {section.modules.length} módulos
                                </span>
                              </>
                          )}
                      </div>
                  </div>

                  {/* Botões de Ação (Só aparecem se não estiver editando) */}
                  {!isEditing && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => startEditing(e, section)}
                            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-all"
                            title="Renomear Seção"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button 
                            onClick={(e) => confirmDeleteSection(e, section.id)} 
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                            title="Excluir Seção"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                  )}
                </div>

                {/* Conteúdo da Seção */}
                {isOpen && (
                    <div className="p-5 bg-black/20 animate-in slide-in-from-top-2 duration-300">
                        <DndContext 
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(e) => handleDragEndModules(e, section.id)}
                        >
                          <SortableContext items={section.modules.map(m => m.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {section.modules.map(mod => (
                                    <SortableModuleCard 
                                      key={mod.id} 
                                      mod={mod} 
                                      sectionId={section.id}
                                      onEnter={handleEnterModule}
                                      onEdit={openEditModuleModal}
                                      onDelete={handleConfirmDeleteModule}
                                    />
                                ))}

                                <button 
                                    onClick={() => openAddModuleModal(section.id)}
                                    className="aspect-[474/1000] border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center hover:bg-white/5 hover:border-white transition-all group"
                                >
                                    <div className="p-4 bg-gray-800 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <span className="text-gray-400 font-bold uppercase text-xs group-hover:text-white">Novo Módulo</span>
                                </button>
                            </div>
                          </SortableContext>
                        </DndContext>
                    </div>
                )}
              </div>
            );
        })}
      </div>

      <MentorshipModuleModal 
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        onSave={handleSaveModule}
        isSaving={isSaving}
        moduleToEdit={moduleToEdit}
      />

      {/* PopUp de Confirmação de Exclusão */}
      <ConfirmationModal 
        isOpen={!!sectionToDelete}
        title="Excluir Seção?"
        message="Tem certeza que deseja excluir esta seção? Todos os módulos e aulas contidos nela serão apagados permanentemente."
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        isDanger={true}
        onConfirm={executeDeleteSection}
        onCancel={() => setSectionToDelete(null)}
      />

      {/* PopUp Excluir Módulo */}
      <ConfirmationModal 
        isOpen={!!moduleToDelete}
        title="Excluir Módulo?"
        message="Tem certeza? Todo o conteúdo (vídeos, pdfs) deste módulo será perdido."
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        isDanger={true}
        onConfirm={executeDeleteModule}
        onCancel={() => setModuleToDelete(null)}
      />
    </div>
  );
}
