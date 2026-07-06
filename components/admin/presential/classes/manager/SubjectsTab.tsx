import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, AlertTriangle, BookOpen, User, CheckSquare, Save, Loader2, Link, GitBranch } from 'lucide-react';
import { Class } from '../../../../../types/class';
import { Subject, Topic, Module, ModuleContent, OnlineStatus, TeachingAreaLink } from '../../../../../types/curriculum';
import { Teacher } from '../../../../../types/teacher';
import { curriculumService } from '../../../../../services/curriculumService';
import { teacherService } from '../../../../../services/teacherService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../../../services/firebase';
import { TeachingAreaSelectorModal } from '../../TeachingAreaSelectorModal';

interface SubjectsTabProps {
  cls: Class;
  onUpdate?: (silent?: boolean) => Promise<void> | void;
}

export const SubjectsTab: React.FC<SubjectsTabProps> = ({ cls, onUpdate }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', color: '#EF4444', defaultTeacherId: '' });
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectDeleteModal, setSubjectDeleteModal] = useState<{ isOpen: boolean, subjectId: string | null }>({ isOpen: false, subjectId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicDeleteModal, setTopicDeleteModal] = useState<{ isOpen: boolean, topicId: string | null }>({ isOpen: false, topicId: null });
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({ name: '', requiredClasses: 0 });
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [moduleDeleteModal, setModuleDeleteModal] = useState<{ isOpen: boolean, topicId: string | null, moduleId: string | null }>({ isOpen: false, topicId: null, moduleId: null });
  const [newModule, setNewModule] = useState<{ 
    name: string; 
    classesCount: number; 
    contents: ModuleContent[];
    isOnline?: boolean;
    onlineStatus?: OnlineStatus;
    publicationDate?: string;
    teachingAreaLink?: TeachingAreaLink;
  }>({ 
    name: '', 
    classesCount: 1, 
    contents: [],
    isOnline: false,
    onlineStatus: 'EM_GRAVACAO',
    publicationDate: '',
    teachingAreaLink: { moduleId: '', folderId: '' }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  // Fetch Data
  const sanitizeModules = (modules: Module[]): Module[] => {
    return (modules || []).map(m => ({
      id: m.id,
      name: m.name || '',
      classesCount: Number(m.classesCount) || 1,
      isSelected: m.isSelected !== false,
      isOnline: !!m.isOnline,
      onlineStatus: m.onlineStatus || 'EM_GRAVACAO',
      publicationDate: m.publicationDate || '',
      contents: (m.contents || []).map((c: any) => ({
        id: c.id,
        type: c.type || 'PDF',
        title: c.title || '',
        url: c.url || '',
        createdAt: c.createdAt || new Date().toISOString(),
        fileType: c.fileType || 'theory',
        linkedTheoryId: c.linkedTheoryId || null
      })),
      teachingAreaLink: m.teachingAreaLink ? {
        moduleId: m.teachingAreaLink.moduleId || '',
        folderId: m.teachingAreaLink.folderId || '',
        moduleName: m.teachingAreaLink.moduleName || null,
        folderName: m.teachingAreaLink.folderName || null
      } : { moduleId: '', folderId: '' }
    }));
  };

  const fetchData = async (silent: boolean = false) => {
    try {
      if (!silent && subjects.length === 0) {
        setLoading(true);
      }
      const [subjectsData, topicsData, teachersData] = await Promise.all([
        curriculumService.getSubjectsByClass(cls.id),
        curriculumService.getTopicsByClass(cls.id),
        teacherService.getTeachers()
      ]);
      setSubjects(subjectsData);
      setTopics(topicsData);
      setTeachers(teachersData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromMaster = async () => {
    if (!cls.masterClassId) return;
    if (subjects.length > 0 && !confirm("Atenção: Esta ação irá importar as disciplinas e assuntos da Turma Mãe. Deseja continuar?")) return;

    try {
      setIsCloning(true);
      await curriculumService.cloneCurriculum(cls.masterClassId, cls.id);
      await fetchData();
      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error importing curriculum:", error);
      alert("Erro ao importar disciplinas da Turma Mãe.");
    } finally {
      setIsCloning(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cls.id]);

  // Calculations
  const totalSelectedClasses = topics
    .filter(t => t.isSelected)
    .reduce((acc, topic) => {
      const topicClasses = topic.modules
        ?.filter(m => m.isSelected !== false && !m.isOnline)
        .reduce((sum, mod) => sum + mod.classesCount, 0) || 0;
      return acc + topicClasses;
    }, 0);

  const meetingsConsumed = Math.ceil(totalSelectedClasses / (cls.classesPerMeeting || 1));
  const meetingsBalance = cls.totalMeetings - meetingsConsumed;
  const isOverLimit = meetingsBalance < 0;

  const handleSaveSubject = async () => {
    if (!newSubject.name) return;

    try {
      if (editingSubject) {
        // Update
        const updatedSubject = { ...editingSubject, ...newSubject };
        setSubjects(prev => prev.map(s => s.id === editingSubject.id ? updatedSubject : s));
        await curriculumService.updateSubject(editingSubject.id, newSubject);
      } else {
        // Create
        const subjectData = {
          classId: cls.id,
          name: newSubject.name,
          color: newSubject.color,
          defaultTeacherId: newSubject.defaultTeacherId || undefined,
          order: subjects.length
        };
        const id = await curriculumService.createSubject(subjectData);
        setSubjects(prev => [...prev, { ...subjectData, id }]);
      }
      setIsModalOpen(false);
      setEditingSubject(null);
      setNewSubject({ name: '', color: '#EF4444', defaultTeacherId: '' });

      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error saving subject:", error);
      fetchData(true);
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setNewSubject({
      name: subject.name,
      color: subject.color,
      defaultTeacherId: subject.defaultTeacherId || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteSubject = async () => {
    if (!subjectDeleteModal.subjectId) return;
    
    try {
      setIsDeleting(true);
      await curriculumService.deleteSubject(subjectDeleteModal.subjectId);
      setSubjects(prev => prev.filter(s => s.id !== subjectDeleteModal.subjectId));
      setSubjectDeleteModal({ isOpen: false, subjectId: null });

      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error deleting subject:", error);
      fetchData(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveTopic = async () => {
    if (!newTopic.name || !selectedSubjectId) return;

    try {
      if (editingTopic) {
        // Update
        const updatedTopic = { ...editingTopic, name: newTopic.name };
        setTopics(prev => prev.map(t => t.id === editingTopic.id ? updatedTopic : t));
        await curriculumService.updateTopic(editingTopic.id, { name: newTopic.name });
      } else {
        // Create
        const topicData = {
          classId: cls.id,
          subjectId: selectedSubjectId,
          name: newTopic.name,
          order: topics.filter(t => t.subjectId === selectedSubjectId).length,
          isSelected: true,
          modules: []
        };
        const id = await curriculumService.createTopic(topicData);
        setTopics(prev => [...prev, { ...topicData, id }]);
      }
      setIsTopicModalOpen(false);
      setEditingTopic(null);
      setNewTopic({ name: '', requiredClasses: 0 });

      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error saving topic:", error);
      fetchData(true);
    }
  };

  const handleEditTopic = (topic: Topic) => {
    setEditingTopic(topic);
    setNewTopic({ name: topic.name, requiredClasses: 0 });
    setSelectedSubjectId(topic.subjectId);
    setIsTopicModalOpen(true);
  };

  const handleDeleteTopic = async () => {
    if (!topicDeleteModal.topicId) return;

    try {
      await curriculumService.deleteTopic(topicDeleteModal.topicId);
      setTopics(prev => prev.filter(t => t.id !== topicDeleteModal.topicId));
      setTopicDeleteModal({ isOpen: false, topicId: null });

      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error deleting topic:", error);
      fetchData(true);
    }
  };

  const handleMoveSubject = async (subjectId: string, direction: 'up' | 'down') => {
    const index = subjects.findIndex(s => s.id === subjectId);
    if (index === -1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subjects.length) return;

    const newSubjects = [...subjects];
    const temp = newSubjects[index];
    newSubjects[index] = newSubjects[targetIndex];
    newSubjects[targetIndex] = temp;

    // Update orders locally
    newSubjects.forEach((s, i) => s.order = i);
    setSubjects(newSubjects);

    try {
      await curriculumService.updateSubjectOrders(newSubjects.map(s => ({ id: s.id, order: s.order || 0 })));
      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error moving subject:", error);
      fetchData(true);
    }
  };

  const handleMoveTopic = async (topicId: string, direction: 'up' | 'down') => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    const subjectTopics = topics.filter(t => t.subjectId === topic.subjectId).sort((a, b) => (a.order || 0) - (b.order || 0));
    const index = subjectTopics.findIndex(t => t.id === topicId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subjectTopics.length) return;

    const newSubjectTopics = [...subjectTopics];
    const temp = newSubjectTopics[index];
    newSubjectTopics[index] = newSubjectTopics[targetIndex];
    newSubjectTopics[targetIndex] = temp;

    // Update orders locally for this subset
    newSubjectTopics.forEach((t, i) => t.order = i);

    // Merge back into main topics list
    const otherTopics = topics.filter(t => t.subjectId !== topic.subjectId);
    const newTopics = [...otherTopics, ...newSubjectTopics];
    setTopics(newTopics);

    try {
      await curriculumService.updateTopicOrders(newSubjectTopics.map(t => ({ id: t.id, order: t.order || 0 })));
      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error moving topic:", error);
      fetchData(true);
    }
  };

  const handleToggleTopicSelection = async (topic: Topic) => {
    try {
      const newStatus = !topic.isSelected;
      
      // Update topic AND all its modules
      const updatedModules = topic.modules?.map(m => ({ ...m, isSelected: newStatus })) || [];
      
      // Optimistic update
      const updatedTopics = topics.map(t => 
        t.id === topic.id ? { ...t, isSelected: newStatus, modules: updatedModules } : t
      );
      setTopics(updatedTopics);

      await curriculumService.updateTopic(topic.id, { isSelected: newStatus, modules: updatedModules });
      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error updating topic selection:", error);
      fetchData(true); // Revert on error
    }
  };

  const handleToggleModuleSelection = async (topicId: string, moduleId: string) => {
    try {
      const topic = topics.find(t => t.id === topicId);
      if (!topic) return;

      const currentModules = topic.modules || [];
      const updatedModules = currentModules.map(m => {
        if (m.id === moduleId) {
          // If undefined (legacy), treat as true, so toggle to false.
          // If false, toggle to true.
          // If true, toggle to false.
          return { ...m, isSelected: m.isSelected === false ? true : false };
        }
        return m;
      });

      // Logic: If at least one module is selected, the topic remains selected.
      // If NO modules are selected, the topic is unselected.
      const hasAnySelected = updatedModules.some(m => m.isSelected !== false);
      const topicSelected = hasAnySelected;

      // Optimistic update
      const updatedTopics = topics.map(t => 
        t.id === topicId ? { ...t, isSelected: topicSelected, modules: updatedModules } : t
      );
      setTopics(updatedTopics);

      const sanitizedModules = sanitizeModules(updatedModules);
      await curriculumService.updateTopic(topicId, { isSelected: topicSelected, modules: sanitizedModules });
      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error updating module selection:", error);
      fetchData(true); // Revert on error
    }
  };

  const handleUpdateTopicTeacher = async (topicId: string, teacherId: string | null) => {
    try {
      // Optimistic update
      const updatedTopics = topics.map(t => 
        t.id === topicId ? { ...t, teacherId: teacherId || undefined } : t
      );
      setTopics(updatedTopics);

      // Send null to remove the field/set to null in Firestore
      await curriculumService.updateTopic(topicId, { teacherId: teacherId as any });
      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error updating topic teacher:", error);
      fetchData(true); // Revert on error
    }
  };

  const handleBulkApplyTeacher = async (subjectId: string) => {
    if (!confirm("Deseja vincular o professor titular a todos os assuntos desta disciplina? Isso removerá professores específicos.")) return;
    
    try {
      const subjectTopics = topics.filter(t => t.subjectId === subjectId);
      
      // Optimistic update
      const updatedTopics = topics.map(t => 
        t.subjectId === subjectId ? { ...t, teacherId: undefined } : t
      );
      setTopics(updatedTopics);

      await Promise.all(subjectTopics.map(t => 
        curriculumService.updateTopic(t.id, { teacherId: null as any })
      ));
      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error bulk updating teachers:", error);
      fetchData(true);
    }
  };

  const handleSaveModule = async () => {
    if (!newModule.name || !activeTopicId) return;
    
    try {
      const topic = topics.find(t => t.id === activeTopicId);
      if (!topic) return;

      const currentModules = topic.modules || [];
      let updatedModules: Module[];

      if (editingModule) {
        updatedModules = currentModules.map(m => 
          m.id === editingModule.id 
            ? { 
                ...m, 
                name: newModule.name, 
                classesCount: newModule.classesCount, 
                contents: newModule.contents,
                isOnline: newModule.isOnline,
                onlineStatus: newModule.onlineStatus,
                publicationDate: newModule.publicationDate,
                teachingAreaLink: newModule.teachingAreaLink
              }
            : m
        );
      } else {
        const newMod: Module = {
          id: Date.now().toString(),
          name: newModule.name,
          classesCount: newModule.classesCount,
          contents: newModule.contents,
          isOnline: newModule.isOnline,
          onlineStatus: newModule.onlineStatus,
          publicationDate: newModule.publicationDate,
          teachingAreaLink: newModule.teachingAreaLink
        };
        updatedModules = [...currentModules, newMod];
      }

      // Optimistic update (with original data for state)
      const updatedTopics = topics.map(t => 
        t.id === activeTopicId ? { ...t, modules: updatedModules } : t
      );
      setTopics(updatedTopics);

      const sanitizedModules = sanitizeModules(updatedModules);
      await curriculumService.updateTopic(activeTopicId, { modules: sanitizedModules });
      
      setIsModuleModalOpen(false);
      setEditingModule(null);
      setNewModule({ 
        name: '', 
        classesCount: 1, 
        contents: [],
        isOnline: false,
        onlineStatus: 'EM_GRAVACAO',
        publicationDate: '',
        teachingAreaLink: { moduleId: '', folderId: '' }
      });

      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error saving module:", error);
      fetchData(true); // Revert on error
    }
  };

  const handleDeleteModule = async () => {
    if (!moduleDeleteModal.topicId || !moduleDeleteModal.moduleId) return;

    try {
      setIsDeleting(true);
      const topic = topics.find(t => t.id === moduleDeleteModal.topicId);
      if (!topic) return;

      const updatedModules = (topic.modules || []).filter(m => m.id !== moduleDeleteModal.moduleId);

      // Optimistic update
      const updatedTopics = topics.map(t => 
        t.id === moduleDeleteModal.topicId ? { ...t, modules: updatedModules } : t
      );
      setTopics(updatedTopics);

      const sanitizedModules = sanitizeModules(updatedModules);
      await curriculumService.updateTopic(moduleDeleteModal.topicId!, { modules: sanitizedModules });
      
      setModuleDeleteModal({ isOpen: false, topicId: null, moduleId: null });

      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error deleting module:", error);
      fetchData(true); // Revert on error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveModule = async (topicId: string, moduleId: string, direction: 'up' | 'down') => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic || !topic.modules) return;

    const moduleIndex = topic.modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) return;

    const targetIndex = direction === 'up' ? moduleIndex - 1 : moduleIndex + 1;
    if (targetIndex < 0 || targetIndex >= topic.modules.length) return;

    const newModules = [...topic.modules];
    const temp = newModules[moduleIndex];
    newModules[moduleIndex] = newModules[targetIndex];
    newModules[targetIndex] = temp;

    // Optimistic update
    const updatedTopics = topics.map(t => 
      t.id === topicId ? { ...t, modules: newModules } : t
    );
    setTopics(updatedTopics);

    try {
      const sanitizedModules = sanitizeModules(newModules);
      await curriculumService.updateTopic(topicId, { modules: sanitizedModules });
      if (onUpdate) await onUpdate(true);
    } catch (error) {
      console.error("Error moving module:", error);
      fetchData(true); // Revert on error
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileType: 'theory' | 'questions' = 'theory') => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    setIsUploadingPdf(true);

    try {
      const fileRef = ref(storage, `class-materials/modules/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);

      const newContent: ModuleContent = {
        id: Date.now().toString(),
        type: 'PDF',
        title: file.name,
        url: downloadUrl,
        createdAt: new Date().toISOString(),
        fileType,
        linkedTheoryId: null
      };

      setNewModule(prev => ({
        ...prev,
        contents: [...(prev.contents || []), newContent]
      }));
    } catch (error) {
      console.error("Error uploading PDF:", error);
      alert("Erro ao fazer upload do PDF. Tente novamente.");
    } finally {
      setIsUploadingPdf(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleUpdatePdfType = (contentId: string, newType: 'theory' | 'questions') => {
    setNewModule(prev => ({
      ...prev,
      contents: prev.contents.map(c => 
        c.id === contentId 
          ? { 
              ...c, 
              fileType: newType, 
              linkedTheoryId: newType === 'theory' ? null : (c.linkedTheoryId || null) 
            } 
          : c
      )
    }));
  };

  const handleUpdateLinkedTheory = (contentId: string, linkedTheoryId: string | null) => {
    setNewModule(prev => ({
      ...prev,
      contents: prev.contents.map(c => 
        c.id === contentId ? { ...c, linkedTheoryId } : c
      )
    }));
  };

  const handleRemovePdf = (contentId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este material?')) {
      setNewModule(prev => ({
        ...prev,
        contents: prev.contents.filter(c => c.id !== contentId)
      }));
    }
  };

  const handleUpdatePdfTitle = (contentId: string, newTitle: string) => {
    setNewModule(prev => ({
      ...prev,
      contents: prev.contents.map(c => 
        c.id === contentId ? { ...c, title: newTitle } : c
      )
    }));
  };

  const handleTeachingAreaSelection = (data: { moduleId: string, moduleName: string, folderId: string, folderName: string }) => {
    setNewModule(prev => ({
      ...prev,
      teachingAreaLink: {
        moduleId: data.moduleId,
        folderId: data.folderId,
        moduleName: data.moduleName,
        folderName: data.folderName
      }
    }));
  };

  const handleSyncGrade = async () => {
    setIsSyncing(true);
    // Simulate processing time
    await new Promise(r => setTimeout(r, 800));
    
    setIsSyncing(false);
    setSyncSuccess(true);
    
    // Reset success state after 3 seconds
    setTimeout(() => {
      setSyncSuccess(false);
    }, 3000);
  };

  const openTopicModal = (subjectId: string) => {
    setEditingTopic(null);
    setNewTopic({ name: '', requiredClasses: 0 });
    setSelectedSubjectId(subjectId);
    setIsTopicModalOpen(true);
  };

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects(prev => 
      prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]
    );
  };

  const getTeacherName = (id?: string) => {
    if (!id) return null;
    return teachers.find(t => t.id === id)?.name || 'Professor não encontrado';
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-in fade-in duration-500">
      {/* Left Column: Subjects List */}
      <div className="flex-1 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Disciplinas e Assuntos</h3>
          <div className="flex items-center gap-2">
            {cls.masterClassId && (
              <button
                onClick={handleImportFromMaster}
                disabled={isCloning}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg font-bold uppercase text-xs tracking-wider transition-colors disabled:opacity-50"
              >
                {isCloning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitBranch className="w-4 h-4" />
                )}
                Importar da Turma Mãe
              </button>
            )}
            <button
              onClick={() => {
                setEditingSubject(null);
                setNewSubject({ name: '', color: '#EF4444', defaultTeacherId: '' });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider transition-colors shadow-lg shadow-brand-red/20"
            >
              <Plus className="w-4 h-4" />
              Nova Disciplina
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {subjects.map(subject => (
            <div key={subject.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => toggleSubject(subject.id)}
                style={{ borderLeft: `4px solid ${subject.color}` }}
              >
                <div className="flex items-center gap-4">
                  <h4 className="font-bold text-white">{subject.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {getTeacherName(subject.defaultTeacherId) || 'Sem Titular'}
                    </span>
                    {subject.defaultTeacherId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBulkApplyTeacher(subject.id);
                        }}
                        className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700 transition-colors"
                        title="Vincular Titular a Todos os Assuntos"
                      >
                        Aplicar a todos
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 mr-2">
                    <div className="flex flex-col mr-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSubject(subject.id, 'up');
                        }}
                        className="p-0.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded"
                        title="Mover para cima"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSubject(subject.id, 'down');
                        }}
                        className="p-0.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSubject(subject);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                      title="Editar Disciplina"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSubjectDeleteModal({ isOpen: true, subjectId: subject.id });
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-800 rounded transition-colors"
                      title="Excluir Disciplina"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {topics.filter(t => t.subjectId === subject.id).length} assuntos
                  </span>
                  {expandedSubjects.includes(subject.id) ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  )}
                </div>
              </div>

              {expandedSubjects.includes(subject.id) && (
                <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 space-y-3">
                  {topics.filter(t => t.subjectId === subject.id).map(topic => (
                    <div key={topic.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg hover:border-zinc-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleTopicSelection(topic)}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                              topic.isSelected 
                                ? 'bg-brand-red text-white' 
                                : 'bg-zinc-800 text-transparent border border-zinc-700 hover:border-zinc-500'
                            }`}
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                          </button>
                          <div>
                            <p className={`text-sm font-medium ${topic.isSelected ? 'text-white' : 'text-zinc-500'}`}>
                              {topic.name}
                            </p>
                            <div className="mt-2">
                              <select
                                value={topic.teacherId || ''}
                                onChange={(e) => handleUpdateTopicTeacher(topic.id, e.target.value || null)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none focus:border-brand-red transition-colors appearance-none cursor-pointer hover:border-zinc-700"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">Herda da Disciplina ({getTeacherName(subject.defaultTeacherId) || 'Sem Titular'})</option>
                                {teachers.map(teacher => (
                                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="block text-xs font-bold text-white">
                              {topic.modules?.reduce((acc, mod) => acc + mod.classesCount, 0) || 0} aulas
                            </span>
                            <span className="text-[10px] text-zinc-600 uppercase">Total</span>
                          </div>
                          
                          <div className="flex items-center gap-1 pl-2 border-l border-zinc-800">
                            <div className="flex flex-col">
                              <button 
                                onClick={() => handleMoveTopic(topic.id, 'up')}
                                className="p-0.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded"
                                title="Mover para cima"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => handleMoveTopic(topic.id, 'down')}
                                className="p-0.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded"
                                title="Mover para baixo"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleEditTopic(topic)}
                              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                              title="Editar Assunto"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setTopicDeleteModal({ isOpen: true, topicId: topic.id })}
                              className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-zinc-800 rounded transition-colors"
                              title="Excluir Assunto"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Modules List */}
                      <div className="mt-3 pl-4 border-l-2 border-zinc-800 space-y-2">
                        {topic.modules?.map((module, index) => (
                          <div key={module.id} className="flex items-center justify-between bg-zinc-950/50 p-2 rounded border border-zinc-800/50 hover:border-zinc-700 transition-colors group">
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox"
                                checked={module.isSelected !== false}
                                onChange={() => handleToggleModuleSelection(topic.id, module.id)}
                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-brand-red focus:ring-brand-red focus:ring-offset-zinc-900 cursor-pointer"
                              />
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${module.isSelected !== false ? 'bg-brand-red' : 'bg-zinc-700'}`} />
                                <span className={`text-xs ${module.isSelected !== false ? 'text-zinc-300' : 'text-zinc-600 line-through'}`}>
                                  {module.name}
                                </span>
                                {module.isOnline && (
                                  <span className="text-[8px] font-bold uppercase px-1 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                    Online
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {module.isOnline ? (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${module.onlineStatus === 'PUBLICADO' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                  {module.onlineStatus === 'PUBLICADO' ? 'Publicado' : 'Em Gravação'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                                  {module.classesCount} aulas
                                </span>
                              )}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex flex-col mr-1">
                                  <button 
                                    onClick={() => handleMoveModule(topic.id, module.id, 'up')}
                                    className="p-0.5 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded"
                                    disabled={index === 0}
                                  >
                                    <ChevronUp className="w-2.5 h-2.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleMoveModule(topic.id, module.id, 'down')}
                                    className="p-0.5 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded"
                                    disabled={index === (topic.modules?.length || 0) - 1}
                                  >
                                    <ChevronDown className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingModule(module);
                                    setNewModule({ 
                                      name: module.name, 
                                      classesCount: module.classesCount, 
                                      contents: module.contents || [],
                                      isOnline: module.isOnline || false,
                                      onlineStatus: module.onlineStatus || 'EM_GRAVACAO',
                                      publicationDate: module.publicationDate || '',
                                      teachingAreaLink: module.teachingAreaLink || { moduleId: '', folderId: '' }
                                    });
                                    setActiveTopicId(topic.id);
                                    setIsModuleModalOpen(true);
                                  }}
                                  className="p-1 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setModuleDeleteModal({ isOpen: true, topicId: topic.id, moduleId: module.id })}
                                  className="p-1 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <button
                          onClick={() => {
                            setEditingModule(null);
                            setNewModule({ 
                              name: '', 
                              classesCount: 1, 
                              contents: [],
                              isOnline: false,
                              onlineStatus: 'EM_GRAVACAO',
                              publicationDate: '',
                              teachingAreaLink: { moduleId: '', folderId: '' }
                            });
                            setActiveTopicId(topic.id);
                            setIsModuleModalOpen(true);
                          }}
                          className="text-[10px] font-bold uppercase text-zinc-600 hover:text-brand-red flex items-center gap-1 mt-2 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Adicionar Módulo
                        </button>
                      </div>
                    </div>
                  ))}

                  <button 
                    onClick={() => openTopicModal(subject.id)}
                    className="w-full py-2 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs font-bold uppercase hover:text-brand-red hover:border-brand-red/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar Assunto
                  </button>
                </div>
              )}
            </div>
          ))}
          
          {subjects.length === 0 && !loading && (
            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              Nenhuma disciplina cadastrada. Comece adicionando uma disciplina.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Workload Dashboard (Sticky) */}
      <div className="lg:w-80 shrink-0">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 sticky top-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
            <BookOpen className="w-5 h-5 text-brand-red" />
            <h3 className="font-bold text-white">Carga Horária</h3>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400">Total de Encontros:</span>
              <span className="text-white font-bold">{cls.totalMeetings}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400">Aulas por Encontro:</span>
              <span className="text-white font-bold">{cls.classesPerMeeting}</span>
            </div>
            
            <div className="pt-4 border-t border-zinc-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-zinc-500 uppercase">Encontros Utilizados</span>
                <span className={`text-xl font-black ${isOverLimit ? 'text-red-500' : 'text-white'}`}>
                  {meetingsConsumed}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${isOverLimit ? 'bg-red-500' : 'bg-brand-red'}`}
                  style={{ width: `${Math.min((meetingsConsumed / cls.totalMeetings) * 100, 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center mt-2 text-xs">
                <span className="text-zinc-500">Saldo Restante:</span>
                <span className={`font-bold ${meetingsBalance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {meetingsBalance} encontros
                </span>
              </div>
            </div>

            <button
              onClick={handleSyncGrade}
              disabled={isSyncing || syncSuccess}
              className={`w-full py-3 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 ${
                syncSuccess 
                  ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' 
                  : 'bg-brand-red hover:bg-red-600 shadow-brand-red/20'
              } ${isSyncing ? 'opacity-70 cursor-wait' : ''}`}
            >
              {isSyncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sincronizando...
                </>
              ) : syncSuccess ? (
                <>
                  <CheckSquare className="w-4 h-4" />
                  Grade Sincronizada!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar e Sincronizar Grade
                </>
              )}
            </button>

            {isOverLimit && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-red-500 uppercase">Limite Excedido</p>
                  <p className="text-[10px] text-red-400 leading-tight">
                    Custo adicional gerado por {Math.abs(meetingsBalance)} encontros extrapolados.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Subject Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingSubject ? 'Editar Disciplina' : 'Nova Disciplina'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Nome da Disciplina</label>
                <input
                  type="text"
                  value={newSubject.name}
                  onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-red transition-colors"
                  placeholder="Ex: Direito Constitucional"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Cor de Identificação</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newSubject.color}
                    onChange={(e) => setNewSubject({ ...newSubject, color: e.target.value })}
                    className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-zinc-500 text-xs uppercase">{newSubject.color}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Professor Titular (Padrão)</label>
                <select
                  value={newSubject.defaultTeacherId}
                  onChange={(e) => setNewSubject({ ...newSubject, defaultTeacherId: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-red transition-colors appearance-none"
                >
                  <option value="">Selecione um professor (Opcional)</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSubject}
                disabled={!newSubject.name}
                className="px-6 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-brand-red/20 transition-colors disabled:opacity-50"
              >
                {editingSubject ? 'Salvar Alterações' : 'Criar Disciplina'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation Modal */}
      {subjectDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Excluir Disciplina</h3>
                <p className="text-zinc-400 text-sm mt-2">
                  Tem certeza que deseja excluir esta disciplina? Todos os assuntos vinculados também serão removidos.
                </p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button
                  onClick={() => setSubjectDeleteModal({ isOpen: false, subjectId: null })}
                  className="flex-1 px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteSubject}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-red-600/20 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Topic Modal */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingTopic ? 'Editar Assunto' : 'Novo Assunto'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Nome do Assunto</label>
                <input
                  type="text"
                  value={newTopic.name}
                  onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-red transition-colors"
                  placeholder="Ex: Controle de Constitucionalidade"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsTopicModalOpen(false)}
                className="px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTopic}
                disabled={!newTopic.name}
                className="px-6 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-brand-red/20 transition-colors disabled:opacity-50"
              >
                {editingTopic ? 'Salvar Alterações' : 'Adicionar Assunto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Topic Confirmation Modal */}
      {topicDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Excluir Assunto</h3>
                <p className="text-zinc-400 text-sm mt-2">
                  Tem certeza que deseja excluir este assunto? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button
                  onClick={() => setTopicDeleteModal({ isOpen: false, topicId: null })}
                  className="flex-1 px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteTopic}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-red-600/20 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Module Modal */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingModule ? 'Editar Módulo' : 'Novo Módulo'}
            </h3>
            
            <div className="space-y-4">
              <div className="flex gap-4 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
                <button
                  onClick={() => setNewModule({ ...newModule, isOnline: false })}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${!newModule.isOnline ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Presencial
                </button>
                <button
                  onClick={() => setNewModule({ ...newModule, isOnline: true })}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${newModule.isOnline ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Online
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Nome do Módulo</label>
                <input
                  type="text"
                  value={newModule.name}
                  onChange={(e) => setNewModule({ ...newModule, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-red transition-colors"
                  placeholder="Ex: Introdução ao Direito"
                />
              </div>

              {!newModule.isOnline ? (
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Quantidade de Aulas</label>
                  <input
                    type="number"
                    min="1"
                    value={newModule.classesCount}
                    onChange={(e) => setNewModule({ ...newModule, classesCount: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-red transition-colors"
                  />
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Quantas aulas são necessárias para este módulo?
                  </p>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Status do Módulo Online</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setNewModule({ ...newModule, onlineStatus: 'EM_GRAVACAO' })}
                        className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${newModule.onlineStatus === 'EM_GRAVACAO' ? 'bg-zinc-800 border-brand-red text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                      >
                        Em Gravação
                      </button>
                      <button
                        onClick={() => setNewModule({ ...newModule, onlineStatus: 'PUBLICADO' })}
                        className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${newModule.onlineStatus === 'PUBLICADO' ? 'bg-zinc-800 border-brand-red text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                      >
                        Publicado
                      </button>
                    </div>
                  </div>

                  {newModule.onlineStatus === 'EM_GRAVACAO' && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Data Prevista de Publicação</label>
                      <input
                        type="date"
                        value={newModule.publicationDate}
                        onChange={(e) => setNewModule({ ...newModule, publicationDate: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-red transition-colors"
                      />
                    </div>
                  )}

                  {newModule.onlineStatus === 'PUBLICADO' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Vínculo com Área de Ensino</label>
                      
                      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col gap-3">
                        {newModule.teachingAreaLink?.moduleId ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Módulo Online</span>
                                <span className="text-xs font-medium text-white">{newModule.teachingAreaLink.moduleName || 'ID: ' + newModule.teachingAreaLink.moduleId}</span>
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Pasta</span>
                                <span className="text-xs font-medium text-amber-500">{newModule.teachingAreaLink.folderName || 'ID: ' + newModule.teachingAreaLink.folderId}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsSelectorOpen(true)}
                              className="w-full mt-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold uppercase tracking-wider rounded transition flex items-center justify-center gap-2"
                            >
                              <Link size={12} />
                              Alterar Vínculo
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsSelectorOpen(true)}
                            className="w-full py-3 border border-dashed border-zinc-700 hover:border-brand-red hover:text-brand-red text-zinc-500 text-xs font-bold uppercase rounded-lg transition flex items-center justify-center gap-2 bg-zinc-950 hover:bg-brand-red/5"
                          >
                            <Link size={14} />
                            Selecionar Conteúdo na Área de Ensino
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Materiais de Apoio (PDF)</label>
                
                <div className="space-y-3 mb-4">
                  {newModule.contents?.filter(c => c.fileType === 'theory' || !c.fileType).map(content => (
                    <div key={content.id} className="space-y-2">
                      <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-800">
                        <select
                          value={content.fileType || 'theory'}
                          onChange={(e) => handleUpdatePdfType(content.id, e.target.value as 'theory' | 'questions')}
                          className="p-1 px-1.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black uppercase focus:outline-none cursor-pointer hover:bg-blue-500/20 transition-colors"
                        >
                          <option value="theory" className="bg-zinc-900 text-white">Teoria</option>
                          <option value="questions" className="bg-zinc-900 text-white">Questões</option>
                        </select>
                        <input
                          type="text"
                          value={content.title}
                          onChange={(e) => handleUpdatePdfTitle(content.id, e.target.value)}
                          className="flex-1 bg-transparent border-none text-xs text-white focus:ring-0 p-0"
                          placeholder="Nome do arquivo"
                        />
                        <button
                          onClick={() => handleRemovePdf(content.id)}
                          className="p-1 text-zinc-500 hover:text-red-500 hover:bg-zinc-900 rounded transition-colors"
                          title="Remover arquivo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Linked Questions */}
                      {newModule.contents?.filter(q => q.fileType === 'questions' && q.linkedTheoryId === content.id).map(question => (
                        <div key={question.id} className="relative ml-6">
                          <div className="absolute -left-4 top-0 h-1/2 w-4 border-b-2 border-l-2 border-zinc-700 rounded-bl-md"></div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 bg-zinc-950/50 p-2 rounded border border-zinc-800">
                              <select
                                value={question.fileType || 'questions'}
                                onChange={(e) => handleUpdatePdfType(question.id, e.target.value as 'theory' | 'questions')}
                                className="p-1 px-1.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[9px] font-black uppercase focus:outline-none cursor-pointer hover:bg-orange-500/20 transition-colors"
                              >
                                <option value="theory" className="bg-zinc-900 text-white">Teoria</option>
                                <option value="questions" className="bg-zinc-900 text-white">Questões</option>
                              </select>
                              <input
                                type="text"
                                value={question.title}
                                onChange={(e) => handleUpdatePdfTitle(question.id, e.target.value)}
                                className="flex-1 bg-transparent border-none text-xs text-white focus:ring-0 p-0"
                                placeholder="Nome do arquivo"
                              />
                              <button
                                onClick={() => handleRemovePdf(question.id)}
                                className="p-1 text-zinc-500 hover:text-red-500 hover:bg-zinc-900 rounded transition-colors"
                                title="Remover arquivo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="ml-6">
                              <select
                                value={question.linkedTheoryId || ''}
                                onChange={(e) => handleUpdateLinkedTheory(question.id, e.target.value || null)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none focus:border-brand-red transition-colors"
                              >
                                <option value="">Vincular a qual material de teoria? (Opcional)</option>
                                {newModule.contents?.filter(c => (c.fileType === 'theory' || !c.fileType) && c.id !== question.id).map(theory => (
                                  <option key={theory.id} value={theory.id}>{theory.title}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Orphaned Questions */}
                  {newModule.contents?.filter(c => c.fileType === 'questions' && !c.linkedTheoryId).map(content => (
                    <div key={content.id} className="space-y-2">
                       <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-800">
                        <select
                          value={content.fileType || 'questions'}
                          onChange={(e) => handleUpdatePdfType(content.id, e.target.value as 'theory' | 'questions')}
                          className="p-1 px-1.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[9px] font-black uppercase focus:outline-none cursor-pointer hover:bg-orange-500/20 transition-colors"
                        >
                          <option value="theory" className="bg-zinc-900 text-white">Teoria</option>
                          <option value="questions" className="bg-zinc-900 text-white">Questões</option>
                        </select>
                        <input
                          type="text"
                          value={content.title}
                          onChange={(e) => handleUpdatePdfTitle(content.id, e.target.value)}
                          className="flex-1 bg-transparent border-none text-xs text-white focus:ring-0 p-0"
                          placeholder="Nome do arquivo"
                        />
                        <button
                          onClick={() => handleRemovePdf(content.id)}
                          className="p-1 text-zinc-500 hover:text-red-500 hover:bg-zinc-900 rounded transition-colors"
                          title="Remover arquivo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="ml-6">
                        <select
                          value={content.linkedTheoryId || ''}
                          onChange={(e) => handleUpdateLinkedTheory(content.id, e.target.value || null)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none focus:border-brand-red transition-colors"
                        >
                          <option value="">Vincular a qual material de teoria? (Opcional)</option>
                          {newModule.contents?.filter(c => c.fileType === 'theory' || !c.fileType).map(theory => (
                            <option key={theory.id} value={theory.id}>{theory.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handlePdfUpload(e, 'theory')}
                      disabled={isUploadingPdf}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className={`w-full py-2 border border-dashed border-zinc-800 rounded-lg flex items-center justify-center gap-2 transition-colors ${isUploadingPdf ? 'bg-zinc-900 opacity-50' : 'hover:border-blue-500/50 hover:bg-blue-500/5'}`}>
                      <Plus className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Teoria</span>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handlePdfUpload(e, 'questions')}
                      disabled={isUploadingPdf}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className={`w-full py-2 border border-dashed border-zinc-800 rounded-lg flex items-center justify-center gap-2 transition-colors ${isUploadingPdf ? 'bg-zinc-900 opacity-50' : 'hover:border-orange-500/50 hover:bg-orange-500/5'}`}>
                      <Plus className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Questões</span>
                    </div>
                  </div>
                </div>
                {isUploadingPdf && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Loader2 className="w-3 h-3 text-brand-red animate-spin" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Fazendo upload...</span>
                  </div>
                )}
              </div>

            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModuleModalOpen(false)}
                className="px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveModule}
                disabled={!newModule.name}
                className="px-6 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-brand-red/20 transition-colors disabled:opacity-50"
              >
                {editingModule ? 'Salvar Alterações' : 'Adicionar Módulo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Module Confirmation Modal */}
      {moduleDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Excluir Módulo</h3>
                <p className="text-zinc-400 text-sm mt-2">
                  Tem certeza que deseja excluir este módulo? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button
                  onClick={() => setModuleDeleteModal({ isOpen: false, topicId: null, moduleId: null })}
                  className="flex-1 px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteModule}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-red-600/20 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TeachingAreaSelectorModal 
        isOpen={isSelectorOpen}
        classId={cls.id}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={handleTeachingAreaSelection}
      />
    </div>
  );
};
