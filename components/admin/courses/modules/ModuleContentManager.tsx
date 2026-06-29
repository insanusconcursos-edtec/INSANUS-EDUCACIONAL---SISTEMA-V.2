import React, { useState, useEffect } from 'react';
import { Folder, Download, Wand2, Layers, FolderTree, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { CourseModule, CourseSubModule, CourseLesson, CourseGroup } from '../../../../types/course';
import { courseService } from '../../../../services/courseService';
import { LessonItem } from './items/LessonItem';
import { SubModuleItem } from './items/SubModuleItem';
import { FolderModal } from './modals/FolderModal';
import { LessonModal } from './modals/LessonModal';
import { GroupModal } from './modals/GroupModal';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { LessonContentManager } from '../lessons/LessonContentManager';
import { PDFTemplate } from '../../../../src/frontend/components/PDFTemplate';
import html2pdf from 'html2pdf.js';

interface ModuleContentManagerProps {
  module: CourseModule;
  onBack: () => void;
}

export function ModuleContentManager({ module, onBack }: ModuleContentManagerProps) {
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [subModules, setSubModules] = useState<CourseSubModule[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Modais
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CourseGroup | null>(null);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<CourseSubModule | null>(null);
  const [parentIdForNewFolder, setParentIdForNewFolder] = useState<string | null>(null);
  
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [targetFolderIdForNewLesson, setTargetFolderIdForNewLesson] = useState<string | null>(null);

  const [itemToDelete, setItemToDelete] = useState<{ type: 'folder' | 'lesson' | 'group', id: string, title: string } | null>(null);
  const [groupToMigrate, setGroupToMigrate] = useState<CourseGroup | null>(null);
  const [lessonToMove, setLessonToMove] = useState<CourseLesson | null>(null);
  const [folderToMove, setFolderToMove] = useState<CourseSubModule | null>(null);

  // Estado para Drill-down de Aula (Gerenciar Conteúdos)
  const [managingLesson, setManagingLesson] = useState<CourseLesson | null>(null);

  // NOVO ESTADO: Controla quais pastas estão abertas (persiste após updates)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Helper para abrir/fechar pasta
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // NOVO ESTADO: Controle de Seleção para IA
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMarkdown, setGeneratedMarkdown] = useState<string | null>(null);
  
  // Novos Campos para Geração de PDF
  const [disciplinaName, setDisciplinaName] = useState('');
  const [disciplinaAssunto, setDisciplinaAssunto] = useState('');
  const [watermark, setWatermark] = useState<string | null>(null);
  const [includeTOC, setIncludeTOC] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const toggleLessonSelection = (lessonId: string) => {
    setSelectedLessonIds(prev => 
      prev.includes(lessonId) 
        ? prev.filter(id => id !== lessonId) 
        : [...prev, lessonId]
    );
  };

  const handleGenerateMaterial = async () => {
    if (selectedLessonIds.length === 0) return;
    
    setIsGenerating(true);
    try {
      // Chamar a API de geração enviando apenas os IDs das aulas
      const response = await fetch('/api/generate-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonIds: selectedLessonIds,
          folderTitle: module.title 
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro do servidor (${response.status}): ${errorText.substring(0, 150)}`);
      }

      const data = await response.json();

      if (data.success) {
        setGeneratedMarkdown(data.markdown);
        console.log("Material gerado com sucesso!");
        console.log("--- MATERIAL DIDÁTICO GERADO (MARKDOWN) ---");
        console.log(data.markdown);
        console.log("-------------------------------------------");
        // Opcional: Limpar seleção
        setSelectedLessonIds([]);
      } else {
        console.error("Erro ao gerar material: " + (data.error || "Erro desconhecido"));
      }
    } catch (error) {
      console.error("Erro ao gerar material:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!generatedMarkdown) return;

    const originalElement = document.getElementById('insanus-pdf-container');
    if (!originalElement) {
        console.error("Erro: Container de PDF não encontrado.");
        return;
    }

    // Cria um clone perfeito para não bugar a tela do usuário
    const element = originalElement.cloneNode(true) as HTMLElement; 

    // Amarra o título com o próximo parágrafo numa div indestrutível
    const headings = element.querySelectorAll('h1, h2, h3, h4');
    headings.forEach(heading => {
      const nextEl = heading.nextElementSibling;
      // Se o próximo elemento existe e não é outro título...
      if (nextEl && !['H1', 'H2', 'H3', 'H4'].includes(nextEl.tagName)) {
        const wrapper = document.createElement('div');
        wrapper.style.pageBreakInside = 'avoid';
        // @ts-expect-error - breakInside is not in all CSSStyleDeclaration types
        wrapper.style.breakInside = 'avoid';
        if (heading.parentNode) {
          heading.parentNode.insertBefore(wrapper, heading);
          wrapper.appendChild(heading);
          wrapper.appendChild(nextEl);
        }
      }
    });

    const opt = {
      margin:       [25, 15, 25, 15], // [Top, Left, Bottom, Right] em mm
      filename:     `${disciplinaName || 'Material'} - ${disciplinaAssunto || 'Insanus'}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      pagebreak:    { mode: ['css', 'legacy'], avoid: ['p', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote'] },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // @ts-expect-error html2pdf is not typed
    html2pdf().set(opt).from(element).toPdf().get('pdf').then(function (pdf: { internal: { getNumberOfPages: () => number, pageSize: { getWidth: () => number, getHeight: () => number } }, setPage: (page: number) => void, setGState: (state: any) => void, GState: any, getImageProperties: (img: string) => { width: number, height: number }, addImage: (img: string, format: string, x: number, y: number, w: number, h: number) => void, setFont: (font: string, style: string) => void, setFontSize: (size: number) => void, text: (text: string, x: number, y: number, options?: any) => void, setLineWidth: (width: number) => void, line: (x1: number, y1: number, x2: number, y2: number) => void, setTextColor: (color: number) => void }) {
      const totalPages = pdf.internal.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);

        // --- MARCA D'ÁGUA ---
        if (watermark) {
          try {
            // Configura opacidade para 10% (suportado no jsPDF mais recente)
            pdf.setGState(new pdf.GState({ opacity: 0.1 }));
            const imgProps = pdf.getImageProperties(watermark);
            const imgWidth = 140; // Largura base
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width; // Altura proporcional
            const x = (pageWidth - imgWidth) / 2;
            const y = (pageHeight - imgHeight) / 2;
            pdf.addImage(watermark, 'PNG', x, y, imgWidth, imgHeight);
            pdf.setGState(new pdf.GState({ opacity: 1.0 })); // Restaura a opacidade para o texto
          } catch (e) {
            console.error("Erro ao aplicar marca d'água:", e);
          }
        }

        // --- CABEÇALHO ---
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        // Texto Esquerda
        pdf.text("INSANUS CONCURSOS", 15, 15);
        // Texto Direita (Nome da Disciplina)
        pdf.setFont('helvetica', 'normal');
        pdf.text((disciplinaName || '').toUpperCase(), pageWidth - 15, 15, { align: 'right' });
        // Linha do Cabeçalho
        pdf.setLineWidth(0.5);
        pdf.line(15, 17, pageWidth - 15, 17);

        // --- RODAPÉ ---
        pdf.setFontSize(7);
        pdf.setTextColor(100);
        const copyrightText = "LEI DO DIREITO AUTORAL-N° 9.610 de 19 de FEVEREIRO de 1998\nPROIBE-SE A COMERCIALIZAÇÃO TOTAL OU PARCIAL DESSE MATERIAL OU DIVULGAÇÃO COM FINS COMERCIAIS OU NÃO,\nEM QUALQUER MEIO DE COMUNICAÇÃO, INCLUSIVE NA INTERNET, SEM AUTORIZAÇÃO EXPRESSA DO INSANUS CONCURSOS.";
        pdf.text(copyrightText, pageWidth / 2, pageHeight - 15, { align: 'center' });

        // Paginação
        pdf.setFontSize(10);
        pdf.setTextColor(0);
        pdf.text(String(i), pageWidth - 15, pageHeight - 10, { align: 'right' });
      }
    }).save();
  };

  // Carregar Dados
  const loadContent = async () => {
    setLoading(true);
    try {
      const [subs, less, grps] = await Promise.all([
        courseService.getSubModules(module.id),
        courseService.getLessons(module.id),
        courseService.getGroups(module.id)
      ]);
      setSubModules(subs);
      setLessons(less);
      setGroups(grps);
      
      // Auto-expand groups that have items
      const groupExpandedState: Record<string, boolean> = {};
      grps.forEach(g => {
        const hasFolders = subs.some(s => s.groupId === g.id);
        const hasLessons = less.some(l => !l.subModuleId && l.groupId === g.id);
        if (hasFolders || hasLessons) {
          groupExpandedState[g.id] = true;
        }
      });
      setExpandedGroups(prev => ({ ...groupExpandedState, ...prev }));
    } catch (error) {
      console.error("Erro ao carregar conteúdo", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, [module.id]);

  // --- CRUD GRUPOS ---
  const handleSaveGroup = async (title: string) => {
    try {
      if (editingGroup) {
        await courseService.updateGroup(editingGroup.id, { title });
        setGroups(prev => prev.map(g => g.id === editingGroup.id ? { ...g, title } : g));
      } else {
        const newId = await courseService.createGroup({
          title,
          moduleId: module.id,
          order: groups.length + 1
        });
        setGroups(prev => [...prev, { id: newId, title, moduleId: module.id, order: groups.length + 1 }]);
        setExpandedGroups(prev => ({ ...prev, [newId]: true }));
      }
    } catch (error) {
      console.error("Erro ao salvar grupo:", error);
    }
  };

  const handleDeleteGroup = async () => {
    if (itemToDelete && itemToDelete.type === 'group') {
      await courseService.deleteGroup(itemToDelete.id);
      // Itens órfãos (o usuário não pediu para excluir os itens, então eles ficam sem grupo)
      await loadContent();
      setItemToDelete(null);
    }
  };

  // --- CRUD PASTAS ---
  const handleSaveFolder = async (title: string, publishDate: string | null, groupId?: string | null, parentId?: string | null, isRecording?: boolean) => {
    try {
      const folderParentId = editingFolder ? (editingFolder.parentId || null) : (parentId || null);
      const data = { title, publishDate, groupId: groupId || null, parentId: folderParentId, isRecording: isRecording || false };
      if (editingFolder) {
        await courseService.updateSubModule(editingFolder.id, data);
        // Atualização Otimista
        setSubModules(prev => prev.map(s => s.id === editingFolder.id ? { ...s, ...data } : s));
      } else {
        const newOrder = subModules.length > 0 ? Math.max(...subModules.map(s => s.order)) + 1 : 1;
        const newId = await courseService.createSubModule({ 
            title, 
            moduleId: module.id, 
            order: newOrder,
            publishDate,
            groupId: groupId || null,
            parentId: folderParentId,
            isRecording: isRecording || false
        });

        // Atualização Otimista
        setSubModules(prev => [...prev, {
            id: newId,
            moduleId: module.id,
            title,
            order: newOrder,
            publishDate,
            groupId: groupId || null,
            parentId: folderParentId,
            isRecording: isRecording || false
        }]);

        // Abre a nova pasta e o pai
        setExpandedFolders(prev => {
          const updated = { ...prev, [newId]: true };
          if (folderParentId) {
            updated[folderParentId] = true;
          }
          return updated;
        });
        if (groupId) toggleGroup(groupId); // Garante que o grupo está aberto
      }
      setIsFolderModalOpen(false); // Fecha o modal
      setEditingFolder(null); // Limpa edição
      setParentIdForNewFolder(null);
    } catch (error) {
      console.error("Erro ao salvar pasta:", error);
      loadContent(); // Reverte em caso de erro
    }
  };

  const handleDeleteFolder = async () => {
    if (itemToDelete && itemToDelete.type === 'folder') {
      await courseService.deleteSubModule(itemToDelete.id);
      await loadContent();
      setItemToDelete(null);
    }
  };

  // --- CRUD AULAS ---
  const handleSaveLesson = async (title: string, coverUrl: string, type: 'video' | 'pdf', groupId?: string | null, isProduction?: boolean) => {
    try {
      const data = { title, coverUrl, type, groupId: groupId || null, isProduction: isProduction || false };
      if (editingLesson) {
        await courseService.updateLesson(editingLesson.id, data);
        // Atualização Otimista
        setLessons(prev => prev.map(l => l.id === editingLesson.id ? { ...l, ...data } : l));
      } else {
        const targetFolderId = targetFolderIdForNewLesson || null;
        
        // Calcular ordem baseado na lista atual (otimista)
        const contextLessons = targetFolderId 
            ? lessons.filter(l => l.subModuleId === targetFolderId)
            : lessons.filter(l => !l.subModuleId);
        
        const newOrder = contextLessons.length > 0 ? Math.max(...contextLessons.map(l => l.order)) + 1 : 1;
        
        const lessonData = {
          title, 
          coverUrl, 
          moduleId: module.id, 
          subModuleId: targetFolderId, 
          groupId: groupId || null,
          order: newOrder,
          type
        };

        const newId = await courseService.createLesson(lessonData);
        
        // Adiciona na lista local imediatamente
        const newLesson: CourseLesson = {
            id: newId,
            ...lessonData,
            videoCount: 0,
            pdfCount: 0
        };
        setLessons(prev => [...prev, newLesson]);

        // Se criou dentro de uma pasta, garante que ela esteja aberta
        if (targetFolderId) {
            setExpandedFolders(prev => ({ ...prev, [targetFolderId]: true }));
        }
        if (groupId) setExpandedGroups(prev => ({ ...prev, [groupId]: true }));
      }
      setIsLessonModalOpen(false);
      setEditingLesson(null);
      setTargetFolderIdForNewLesson(null);
    } catch (error) {
        console.error("Erro ao salvar aula:", error);
        loadContent(); // Reverte em caso de erro
    }
  };

  const handleDeleteLesson = async () => {
    if (itemToDelete && itemToDelete.type === 'lesson') {
      await courseService.deleteLesson(itemToDelete.id);
      await loadContent();
      setItemToDelete(null);
    }
  };

  // --- NOVA FUNÇÃO: Reordenar Aulas ---
  // contextId: ID da pasta (se estiver em pasta) ou null (se estiver na raiz)
  const handleReorderLesson = async (index: number, direction: 'up' | 'down', contextId: string | null) => {
    // 1. Filtra a lista correta (Pasta ou Raiz)
    const contextLessons = lessons
        .filter(l => l.subModuleId === contextId)
        // Garante que estamos operando na lista ordenada visualmente
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Verificações de segurança
    if (targetIndex < 0 || targetIndex >= contextLessons.length) return;

    // 2. Troca as posições na lista filtrada
    // Clonamos o array para não mutar o estado diretamente antes do set
    const reorderedGroup = [...contextLessons];
    
    // Swap objects in the array
    [reorderedGroup[index], reorderedGroup[targetIndex]] = [reorderedGroup[targetIndex], reorderedGroup[index]];

    // Recalculate 'order' for the whole group to be sequential
    const updates = reorderedGroup.map((l, idx) => ({ ...l, order: idx + 1 }));

    // 3. Atualiza o estado global de lessons
    const newAllLessons = lessons.map(l => {
        const updated = updates.find(u => u.id === l.id);
        return updated || l;
    });

    setLessons(newAllLessons); // Feedback visual imediato

    // 4. Salva no banco
    try {
        await courseService.reorderLessons(updates);
    } catch (error) {
        console.error("Erro ao salvar ordem das aulas", error);
        loadContent(); // Reverte em caso de erro
    }
  };

  // --- NOVA FUNÇÃO: Reordenar Conteúdo Misto (Pastas + Aulas Raiz) (APENAS ÓRFÃOS) ---
  const handleReorderMixed = async (index: number, direction: 'up' | 'down') => {
    const mixedContent = [
      ...subModules.filter(f => !f.groupId && !f.parentId).map(f => ({ type: 'folder' as const, id: f.id, order: f.order })),
      ...lessons.filter(l => !l.subModuleId && !l.groupId).map(l => ({ type: 'lesson' as const, id: l.id, order: l.order }))
    ].sort((a, b) => (a.order || 0) - (b.order || 0));

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mixedContent.length) return;

    // Swap
    [mixedContent[index], mixedContent[targetIndex]] = [mixedContent[targetIndex], mixedContent[index]];

    // Recalculate orders
    const updates = mixedContent.map((item, idx) => ({ ...item, order: idx + 1 }));

    // Update local state
    setSubModules(prev => prev.map(s => {
      const update = updates.find(u => u.type === 'folder' && u.id === s.id);
      return update ? { ...s, order: update.order } : s;
    }).sort((a, b) => a.order - b.order));

    setLessons(prev => prev.map(l => {
      const update = updates.find(u => u.type === 'lesson' && u.id === l.id);
      return update ? { ...l, order: update.order } : l;
    }).sort((a, b) => a.order - b.order));

    // Save to DB
    try {
      await courseService.reorderMixedContent(updates);
    } catch (error) {
      console.error("Erro ao reordenar conteúdo misto", error);
      loadContent();
    }
  };

  const handleReorderMixedInGroup = async (groupId: string, index: number, direction: 'up' | 'down') => {
    const mixedContent = [
      ...subModules.filter(f => f.groupId === groupId && !f.parentId).map(f => ({ type: 'folder' as const, id: f.id, order: f.order })),
      ...lessons.filter(l => !l.subModuleId && l.groupId === groupId).map(l => ({ type: 'lesson' as const, id: l.id, order: l.order }))
    ].sort((a, b) => (a.order || 0) - (b.order || 0));

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mixedContent.length) return;

    // Swap
    [mixedContent[index], mixedContent[targetIndex]] = [mixedContent[targetIndex], mixedContent[index]];

    // Recalculate orders
    const updates = mixedContent.map((item, idx) => ({ ...item, order: idx + 1 }));

    // Update local state
    setSubModules(prev => prev.map(s => {
      const update = updates.find(u => u.type === 'folder' && u.id === s.id);
      return update ? { ...s, order: update.order } : s;
    }).sort((a, b) => a.order - b.order));

    setLessons(prev => prev.map(l => {
      const update = updates.find(u => u.type === 'lesson' && u.id === l.id);
      return update ? { ...l, order: update.order } : l;
    }).sort((a, b) => a.order - b.order));

    // Save to DB
    try {
      await courseService.reorderMixedContent(updates);
    } catch (error) {
      console.error("Erro ao reordenar conteúdo no grupo", error);
      loadContent();
    }
  };

  const handleReorderGroups = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;

    const newGroups = [...groups];
    [newGroups[index], newGroups[targetIndex]] = [newGroups[targetIndex], newGroups[index]];

    const updates = newGroups.map((g, idx) => ({ ...g, order: idx + 1 }));
    setGroups(updates);

    try {
      await courseService.reorderGroups(updates);
    } catch (error) {
      console.error("Erro ao reordenar grupos", error);
      loadContent();
    }
  };

  const handleMoveLessonConfirm = async (targetFolderId: string | null) => {
    if (lessonToMove) {
        await courseService.moveLesson(lessonToMove.id, targetFolderId);
        await loadContent();
        setLessonToMove(null);
    }
  };

  const handleMoveFolderConfirm = async (targetParentId: string | null) => {
    if (folderToMove) {
        await courseService.moveSubModule(folderToMove.id, targetParentId);
        await loadContent();
        setFolderToMove(null);
    }
  };

  const handleMigrateGroupToDiscipline = async () => {
    if (!groupToMigrate) return;
    try {
      await courseService.migrateGroupToStandaloneModule(groupToMigrate.id);
      await loadContent();
      setGroupToMigrate(null);
    } catch (error) {
      console.error("Erro ao migrar grupo:", error);
      alert("Erro ao realizar a migração.");
    }
  };

  // Filtrar aulas por pasta
  const getLessonsInFolder = (folderId: string) => lessons
    .filter(l => l.subModuleId === folderId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Árvore real de pastas para exibição hierárquica no modal de mover
  const hierarchicalFolders = React.useMemo(() => {
    const list: { folder: CourseSubModule; depth: number }[] = [];
    
    const addFolderAndChildren = (folder: CourseSubModule, depth: number) => {
      if (list.some(item => item.folder.id === folder.id)) return;
      
      list.push({ folder, depth });
      
      const children = subModules
        .filter(s => s.parentId === folder.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
        
      children.forEach(child => addFolderAndChildren(child, depth + 1));
    };

    // 1. Órfãos (sem grupo e sem pai)
    const orphanRootFolders = subModules
      .filter(s => !s.groupId && !s.parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    orphanRootFolders.forEach(folder => addFolderAndChildren(folder, 0));

    // 2. Grupos (ordenados por group order)
    groups
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(group => {
        const groupRootFolders = subModules
          .filter(s => s.groupId === group.id && !s.parentId)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        groupRootFolders.forEach(folder => addFolderAndChildren(folder, 0));
      });

    return list;
  }, [subModules, groups]);

  // Reordenar conteúdo misto (pastas + aulas) dentro de uma pasta
  const handleReorderMixedInFolder = async (parentFolderId: string, index: number, direction: 'up' | 'down') => {
    const mixedContent = [
      ...subModules.filter(f => f.parentId === parentFolderId).map(f => ({ type: 'folder' as const, id: f.id, order: f.order })),
      ...lessons.filter(l => l.subModuleId === parentFolderId).map(l => ({ type: 'lesson' as const, id: l.id, order: l.order }))
    ].sort((a, b) => (a.order || 0) - (b.order || 0));

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mixedContent.length) return;

    // Swap
    [mixedContent[index], mixedContent[targetIndex]] = [mixedContent[targetIndex], mixedContent[index]];

    // Recalculate orders
    const updates = mixedContent.map((item, idx) => ({ ...item, order: idx + 1 }));

    // Update local state
    setSubModules(prev => prev.map(s => {
      const update = updates.find(u => u.type === 'folder' && u.id === s.id);
      return update ? { ...s, order: update.order } : s;
    }).sort((a, b) => a.order - b.order));

    setLessons(prev => prev.map(l => {
      const update = updates.find(u => u.type === 'lesson' && u.id === l.id);
      return update ? { ...l, order: update.order } : l;
    }).sort((a, b) => a.order - b.order));

    // Save to DB
    try {
      await courseService.reorderMixedContent(updates);
    } catch (error) {
      console.error("Erro ao reordenar conteúdo no folder", error);
      loadContent();
    }
  };

  // Renderizador recursivo de Pastas (Submódulos) e suas subpastas
  const renderFolderRecursive = (folder: CourseSubModule, listItemsSibling: any[], index: number) => {
    const childFolders = subModules
      .filter(s => s.parentId === folder.id)
      .map(f => ({ type: 'folder' as const, id: f.id, order: f.order || 0, data: f }));

    const childLessons = lessons
      .filter(l => l.subModuleId === folder.id)
      .map(l => ({ type: 'lesson' as const, id: l.id, order: l.order || 0, data: l }));

    const combinedChildren = [...childFolders, ...childLessons]
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const lessonsList = childLessons.map(i => i.data);

    return (
      <SubModuleItem 
        key={folder.id}
        subModule={folder}
        lessons={lessonsList}
        
        onEdit={() => { setEditingFolder(folder); setIsFolderModalOpen(true); }}
        onDelete={() => setItemToDelete({ type: 'folder', id: folder.id, title: folder.title })}
        onAddLesson={() => { setEditingLesson(null); setTargetFolderIdForNewLesson(folder.id); setIsLessonModalOpen(true); }}
        onAddSubFolder={() => { setParentIdForNewFolder(folder.id); setEditingFolder(null); setIsFolderModalOpen(true); }}
        onMove={() => setFolderToMove(folder)}
        onEditLesson={(l) => { setEditingLesson(l); setIsLessonModalOpen(true); }}
        onDeleteLesson={(l) => setItemToDelete({ type: 'lesson', id: l.id, title: l.title })}
        onMoveLesson={setLessonToMove}
        onManageLesson={setManagingLesson} 
        
        onMoveUp={() => {
          if (folder.parentId) {
            handleReorderMixedInFolder(folder.parentId, index, 'up');
          } else if (folder.groupId) {
            handleReorderMixedInGroup(folder.groupId, index, 'up');
          } else {
            handleReorderMixed(index, 'up');
          }
        }}
        onMoveDown={() => {
          if (folder.parentId) {
            handleReorderMixedInFolder(folder.parentId, index, 'down');
          } else if (folder.groupId) {
            handleReorderMixedInGroup(folder.groupId, index, 'down');
          } else {
            handleReorderMixed(index, 'down');
          }
        }}
        onReorderLesson={(idx, dir) => handleReorderMixedInFolder(folder.id, idx, dir)}
        isFirst={index === 0}
        isLast={index === listItemsSibling.length - 1}

        isOpen={!!expandedFolders[folder.id]}
        onToggle={() => toggleFolder(folder.id)}

        selectedLessonIds={selectedLessonIds}
        onToggleLessonSelection={toggleLessonSelection}
      >
        {combinedChildren.map((child, childIdx) => {
          if (child.type === 'folder') {
            return renderFolderRecursive(child.data, combinedChildren, childIdx);
          } else {
            const lesson = child.data;
            return (
              <LessonItem 
                key={lesson.id}
                lesson={lesson}
                onEdit={() => { setEditingLesson(lesson); setIsLessonModalOpen(true); }}
                onDelete={() => setItemToDelete({ type: 'lesson', id: lesson.id, title: lesson.title })}
                onMove={() => setLessonToMove(lesson)}
                onManageContent={() => setManagingLesson(lesson)} 
                onReorderUp={() => handleReorderMixedInFolder(folder.id, childIdx, 'up')}
                onReorderDown={() => handleReorderMixedInFolder(folder.id, childIdx, 'down')}
                isFirst={childIdx === 0}
                isLast={childIdx === combinedChildren.length - 1}

                isSelected={selectedLessonIds.includes(lesson.id)}
                onToggleSelection={toggleLessonSelection}
              />
            );
          }
        })}
      </SubModuleItem>
    );
  };

  // Renderização do LessonContentManager
  if (managingLesson) {
      return (
          <LessonContentManager 
            lesson={managingLesson}
            onBack={() => setManagingLesson(null)}
          />
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-gray-800 pb-6">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Módulo</span>
          <h2 className="text-2xl font-black text-white uppercase">{module.title}</h2>
        </div>
        <div className="flex-1"></div>
        <div className="flex gap-3 items-end">
            {selectedLessonIds.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Disciplina</label>
                            <input 
                                type="text"
                                value={disciplinaName}
                                onChange={e => setDisciplinaName(e.target.value)}
                                placeholder="Ex: DIREITO CONSTITUCIONAL"
                                className="bg-black border border-gray-800 rounded px-3 py-2 text-xs text-white focus:border-red-600 outline-none w-48"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Assunto</label>
                            <input 
                                type="text"
                                value={disciplinaAssunto}
                                onChange={e => setDisciplinaAssunto(e.target.value)}
                                placeholder="Ex: SEGURANÇA PÚBLICA (ART. 144)"
                                className="bg-black border border-gray-800 rounded px-3 py-2 text-xs text-white focus:border-red-600 outline-none w-64"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Marca D&apos;água (Opcional)</label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => setWatermark(event.target?.result as string);
                                        reader.readAsDataURL(file);
                                    }
                                }} 
                                className="bg-black border border-gray-800 rounded px-2 py-1 text-[10px] text-white focus:border-red-600 outline-none w-48"
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-4">
                            <input 
                                type="checkbox"
                                id="includeTOC"
                                checked={includeTOC}
                                onChange={e => setIncludeTOC(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-800 bg-black text-red-600 focus:ring-red-600"
                            />
                            <label htmlFor="includeTOC" className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors">
                                Incluir Sumário (Índice) na primeira página
                            </label>
                        </div>
                    </div>
                    <button 
                        onClick={handleGenerateMaterial}
                        disabled={isGenerating || !disciplinaName || !disciplinaAssunto}
                        className={`px-4 py-2 ${isGenerating || !disciplinaName || !disciplinaAssunto ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-600 hover:bg-purple-500 text-white'} font-bold uppercase text-xs rounded flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20`}
                    >
                        {isGenerating ? (
                            <>
                                <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-white"></div>
                                Gerando com IA...
                            </>
                        ) : (
                            <>
                                <Wand2 size={14} />
                                Gerar Material Didático (IA) ({selectedLessonIds.length})
                            </>
                        )}
                    </button>
                </div>
            )}

            {generatedMarkdown && (
                <div className="flex gap-2">
                    <button 
                        onClick={handleDownloadPDF}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase text-xs rounded px-4 py-2 flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
                    >
                        <Download size={14} />
                        Baixar PDF Padrão Insanus
                    </button>
                </div>
            )}

            <button 
                onClick={() => { setEditingGroup(null); setIsGroupModalOpen(true); }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase text-xs rounded border border-zinc-700 flex items-center gap-2"
            >
                <Layers size={16} className="text-zinc-500" />
                Criar Grupo
            </button>
            <button 
                onClick={() => { setEditingFolder(null); setIsFolderModalOpen(true); }}
                className="px-4 py-2 bg-[#1a1d24] border border-gray-700 hover:border-gray-500 text-white font-bold uppercase text-xs rounded flex items-center gap-2"
            >
                <Folder size={16} className="text-yellow-500" fill="currentColor" />
                Criar Pasta
            </button>
            <button 
                onClick={() => { setEditingLesson(null); setTargetFolderIdForNewLesson(null); setIsLessonModalOpen(true); }}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded shadow-lg shadow-red-900/20 flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Criar Aula
            </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="space-y-4 max-w-4xl mx-auto pb-20">
        {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div></div>
        ) : (
            <>
                 {/* --- SEÇÃO 1: ITENS ÓRFÃOS (SEM GRUPO) --- */}
                <div className="space-y-3">
                  {[
                    ...subModules.filter(s => !s.groupId && !s.parentId).map(folder => ({ type: 'folder' as const, id: folder.id, data: folder, order: folder.order })),
                    ...lessons.filter(l => !l.subModuleId && !l.groupId).map(lesson => ({ type: 'lesson' as const, id: lesson.id, data: lesson, order: lesson.order }))
                  ]
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((item, index, array) => {
                    if (item.type === 'folder') {
                      return renderFolderRecursive(item.data, array, index);
                    } else {
                      const lesson = item.data;
                      return (
                        <LessonItem 
                          key={lesson.id}
                          lesson={lesson}
                          onEdit={() => { setEditingLesson(lesson); setIsLessonModalOpen(true); }}
                          onDelete={() => setItemToDelete({ type: 'lesson', id: lesson.id, title: lesson.title })}
                          onMove={() => setLessonToMove(lesson)}
                          onManageContent={() => setManagingLesson(lesson)} 
                          onReorderUp={() => handleReorderMixed(index, 'up')}
                          onReorderDown={() => handleReorderMixed(index, 'down')}
                          isFirst={index === 0}
                          isLast={index === array.length - 1}

                          isSelected={selectedLessonIds.includes(lesson.id)}
                          onToggleSelection={toggleLessonSelection}
                        />
                      );
                    }
                  })}
                </div>

                {/* --- SEÇÃO 2: GRUPOS (ACORDEÕES) --- */}
                {groups.sort((a,b) => a.order - b.order).map((group, groupIdx) => {
                  const groupItems = [
                    ...subModules.filter(s => s.groupId === group.id && !s.parentId).map(folder => ({ type: 'folder' as const, id: folder.id, data: folder, order: folder.order })),
                    ...lessons.filter(l => !l.subModuleId && l.groupId === group.id).map(lesson => ({ type: 'lesson' as const, id: lesson.id, data: lesson, order: lesson.order }))
                  ].sort((a, b) => (a.order || 0) - (b.order || 0));

                  const isExpanded = expandedGroups[group.id];

                  return (
                    <div key={group.id} className="border border-gray-800 rounded-xl overflow-hidden bg-zinc-900/20">
                      {/* Header do Grupo */}
                      <div 
                        className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-900/60' : 'hover:bg-zinc-900/40'}`}
                        onClick={() => toggleGroup(group.id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400 shrink-0">
                            <FolderTree size={18} />
                          </div>
                          <h3 className="font-black text-xs text-white uppercase tracking-wider">{group.title}</h3>
                          <span className="text-[10px] font-bold text-gray-500 bg-black/50 px-2 py-0.5 rounded-full border border-gray-800 shrink-0">
                            {groupItems.length} ITENS
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                           {/* Controles de Grupo */}
                           <div className="flex items-center gap-1 mr-4 border-r border-gray-800 pr-4" onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={() => { setEditingGroup(group); setIsGroupModalOpen(true); }}
                                className="p-1 hover:bg-white/5 rounded text-gray-500 hover:text-white transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button 
                                onClick={() => setGroupToMigrate(group)}
                                className="p-1 hover:bg-orange-900/20 rounded text-gray-500 hover:text-orange-500 transition-colors"
                                title="Migrar este grupo para fora como uma nova disciplina"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                              </button>
                              <button 
                                onClick={() => setItemToDelete({ type: 'group', id: group.id, title: group.title })}
                                className="p-1 hover:bg-red-900/20 rounded text-gray-500 hover:text-red-500 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                              <div className="flex flex-col gap-0.5 ml-2">
                                <button 
                                  disabled={groupIdx === 0}
                                  onClick={() => handleReorderGroups(groupIdx, 'up')}
                                  className="p-0.5 hover:bg-gray-700 rounded disabled:opacity-30"
                                >
                                  <ChevronDown size={14} className="rotate-180" />
                                </button>
                                <button 
                                  disabled={groupIdx === groups.length - 1}
                                  onClick={() => handleReorderGroups(groupIdx, 'down')}
                                  className="p-0.5 hover:bg-gray-700 rounded disabled:opacity-30"
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </div>
                           </div>

                           {isExpanded ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                        </div>
                      </div>

                      {/* Corpo do Grupo */}
                      {isExpanded && (
                        <div className="p-4 pt-0 space-y-3 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                          {groupItems.length === 0 ? (
                            <div className="text-center py-8 border border-dashed border-gray-800 rounded-lg">
                              <p className="text-gray-600 text-[10px] font-bold uppercase">Nenhum item neste grupo</p>
                            </div>
                          ) : (
                            groupItems.map((item, index) => {
                              if (item.type === 'folder') {
                                return renderFolderRecursive(item.data, groupItems, index);
                              } else {
                                return (
                                  <LessonItem 
                                    key={item.id}
                                    lesson={item.data}
                                    onEdit={() => { setEditingLesson(item.data); setIsLessonModalOpen(true); }}
                                    onDelete={() => setItemToDelete({ type: 'lesson', id: item.id, title: item.data.title })}
                                    onMove={() => setLessonToMove(item.data)}
                                    onManageContent={() => setManagingLesson(item.data)} 
                                    
                                    onReorderUp={() => handleReorderMixedInGroup(group.id, index, 'up')}
                                    onReorderDown={() => handleReorderMixedInGroup(group.id, index, 'down')}

                                    isSelected={selectedLessonIds.includes(item.id)}
                                    onToggleSelection={toggleLessonSelection}
                                    isFirst={index === 0}
                                    isLast={index === groupItems.length - 1}
                                  />
                                );
                              }
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {lessons.length === 0 && subModules.length === 0 && groups.length === 0 && (
                    <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl">
                        <p className="text-gray-500">Este módulo está vazio.</p>
                    </div>
                )}
            </>
        )}
      </div>

      {/* --- MODAIS --- */}
      
      <GroupModal 
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onSave={handleSaveGroup}
        initialTitle={editingGroup?.title}
      />

      <FolderModal 
        isOpen={isFolderModalOpen}
        onClose={() => { setIsFolderModalOpen(false); setParentIdForNewFolder(null); }}
        onSave={handleSaveFolder}
        initialTitle={editingFolder?.title}
        initialPublishDate={editingFolder?.publishDate}
        initialGroupId={editingFolder?.groupId || (parentIdForNewFolder ? subModules.find(s => s.id === parentIdForNewFolder)?.groupId : null)}
        initialParentId={editingFolder ? editingFolder.parentId : parentIdForNewFolder}
        initialIsRecording={editingFolder?.isRecording}
        groups={groups}
      />

      <LessonModal 
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        onSave={handleSaveLesson}
        initialTitle={editingLesson?.title}
        initialCover={editingLesson?.coverUrl}
        initialType={editingLesson?.type}
        initialGroupId={editingLesson?.groupId}
        initialIsProduction={editingLesson?.isProduction}
        groups={groups}
      />

      <ConfirmationModal 
        isOpen={!!itemToDelete}
        title={`Excluir ${itemToDelete?.type === 'folder' ? 'Pasta' : itemToDelete?.type === 'group' ? 'Grupo' : 'Aula'}?`}
        message={`Deseja excluir "${itemToDelete?.title}"? ${itemToDelete?.type === 'group' ? 'Os itens internos NÃO serão excluídos, mas ficarão sem grupo.' : ''}`}
        onConfirm={itemToDelete?.type === 'folder' ? handleDeleteFolder : itemToDelete?.type === 'group' ? handleDeleteGroup : handleDeleteLesson}
        onCancel={() => setItemToDelete(null)}
        isDanger
      />

      <ConfirmationModal 
        isOpen={!!groupToMigrate}
        title="Migrar Grupo para Disciplina?"
        message={`Deseja transformar o grupo "${groupToMigrate?.title}" em uma nova disciplina? Ele sairá deste módulo e se tornará um item independente na lista de disciplinas do curso.`}
        onConfirm={handleMigrateGroupToDiscipline}
        onCancel={() => setGroupToMigrate(null)}
        confirmLabel="Sim, Migrar"
        cancelLabel="Cancelar"
      />

      {/* Modal para Mover Aula */}
      {lessonToMove && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-800"><h3 className="text-white font-bold">Mover &quot;{lessonToMove.title}&quot; para...</h3></div>
                <div className="p-2 space-y-1 max-h-[350px] overflow-y-auto">
                    <button 
                        onClick={() => handleMoveLessonConfirm(null)}
                        className={`w-full text-left px-4 py-3 rounded hover:bg-gray-800 text-sm ${!lessonToMove.subModuleId ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'text-gray-300'}`}
                    >
                        (Raiz do Módulo)
                    </button>
                    {hierarchicalFolders.map(item => (
                        <button 
                            key={item.folder.id}
                            style={{ paddingLeft: `${(item.depth * 16) + 16}px` }}
                            onClick={() => handleMoveLessonConfirm(item.folder.id)}
                            className={`w-full text-left py-3 rounded hover:bg-gray-800 text-sm flex items-center gap-2 ${lessonToMove.subModuleId === item.folder.id ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'text-gray-300'}`}
                        >
                            <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                            <span className="truncate">{item.folder.title}</span>
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-800 flex justify-end">
                    <button onClick={() => setLessonToMove(null)} className="text-gray-400 hover:text-white text-xs font-bold uppercase">Cancelar</button>
                </div>
            </div>
        </div>
      )}

      {/* Modal para Mover Pasta */}
      {folderToMove && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-800"><h3 className="text-white font-bold">Mover Pasta &quot;{folderToMove.title}&quot; para...</h3></div>
                <div className="p-2 space-y-1 max-h-[350px] overflow-y-auto">
                    <button 
                        onClick={() => handleMoveFolderConfirm(null)}
                        className={`w-full text-left px-4 py-3 rounded hover:bg-gray-800 text-sm ${!folderToMove.parentId ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'text-gray-300'}`}
                    >
                        (Raiz do Módulo)
                    </button>
                    {hierarchicalFolders.filter(item => {
                        // Não pode mover para si mesma
                        if (item.folder.id === folderToMove.id) return false;
                        
                        // Não pode mover para um dos seus próprios filhos (prevenção de ciclo)
                        // Precisamos verificar se a pasta destino tem o folderToMove.id em sua árvore de pais.
                        // Para simplificar, vou verificar se o item.folder.parentId é o folderToMove.id, etc.
                        // Mas como temos a profundidade e a lista ordenada, podemos deduzir.
                        // No entanto, hierarquicalFolders é calculada no Memo, então podemos usar uma lógica recursiva ou rastrear o caminho.
                        
                        let isDescendant = false;
                        let current = item.folder;
                        while (current.parentId) {
                            if (current.parentId === folderToMove.id) {
                                isDescendant = true;
                                break;
                            }
                            // Encontrar o pai na lista total
                            const parent = subModules.find(s => s.id === current.parentId);
                            if (!parent) break;
                            current = parent;
                        }
                        return !isDescendant;
                    }).map(item => (
                        <button 
                            key={item.folder.id}
                            style={{ paddingLeft: `${(item.depth * 16) + 16}px` }}
                            onClick={() => handleMoveFolderConfirm(item.folder.id)}
                            className={`w-full text-left py-3 rounded hover:bg-gray-800 text-sm flex items-center gap-2 ${folderToMove.parentId === item.folder.id ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'text-gray-300'}`}
                        >
                            <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                            <span className="truncate">{item.folder.title}</span>
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-800 flex justify-end">
                    <button onClick={() => setFolderToMove(null)} className="text-gray-400 hover:text-white text-xs font-bold uppercase">Cancelar</button>
                </div>
            </div>
        </div>
      )}

      {/* Template de PDF Oculto */}
      {generatedMarkdown && (
        <PDFTemplate 
          markdownText={generatedMarkdown}
          disciplinaName={disciplinaName}
          disciplinaAssunto={disciplinaAssunto}
          includeTOC={includeTOC}
          containerRef={containerRef}
        />
      )}
    </div>
  );
}