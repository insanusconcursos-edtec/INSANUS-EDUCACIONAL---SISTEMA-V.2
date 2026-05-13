
import React, { useState, useEffect } from 'react';
import { courseService } from '../../../services/courseService';
import { getCategories, Category } from '../../../services/planService';
import { OnlineCourse, CourseFormData } from '../../../types/course';
import { CourseCard } from './CourseCard';
import { CourseModal } from './CourseModal';
import { CourseContentManager } from './CourseContentManager';
import ConfirmationModal from '../../ui/ConfirmationModal';
import CategoryManager from '../CategoryManager';

import toast from 'react-hot-toast';

export function AdminCoursesTab() {
  // Estados de Dados
  const [courses, setCourses] = useState<OnlineCourse[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<OnlineCourse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  
  // Estados de Modais e Navegação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<OnlineCourse | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<OnlineCourse | null>(null);
  const [courseToDuplicate, setCourseToDuplicate] = useState<OnlineCourse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Estado para Gerenciamento de Conteúdo (Navegação)
  const [managingCourse, setManagingCourse] = useState<OnlineCourse | null>(null);

  // Carregar Dados Iniciais
  const loadData = async () => {
    setLoading(true);
    try {
      const [coursesData, categoriesData] = await Promise.all([
        courseService.getCourses(),
        getCategories()
      ]);
      setCourses(coursesData);
      setCategories(categoriesData);
      setFilteredCourses(coursesData);
    } catch (error) {
      console.error("Erro ao carregar dados", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lógica de Filtragem Avançada
  useEffect(() => {
    const results = courses.filter(course => {
      // 1. Filtro de Texto (Nome ou Órgão)
      const matchesSearch = 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.organization?.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Filtro de Categoria
      const matchesCategory = selectedCategory ? course.categoryId === selectedCategory : true;

      // 3. Filtro de Subcategoria
      const matchesSubcategory = selectedSubcategory ? course.subcategoryId === selectedSubcategory : true;

      return matchesSearch && matchesCategory && matchesSubcategory;
    });
    setFilteredCourses(results);
  }, [searchTerm, selectedCategory, selectedSubcategory, courses]);

  // Handlers CRUD
  const handleSaveCourse = async (data: CourseFormData, bannerDesktopFile?: File, bannerMobileFile?: File) => {
    if (editingCourse) {
      await courseService.updateCourse(editingCourse.id, data, bannerDesktopFile, bannerMobileFile);
    } else {
      await courseService.createCourse(data, bannerDesktopFile, bannerMobileFile);
    }
    await loadData();
    setEditingCourse(null);
  };

  const handleDeleteCourse = async () => {
    if (courseToDelete) {
      setIsProcessing(true);
      try {
        await courseService.deleteCourse(courseToDelete.id);
        await loadData();
        setCourseToDelete(null);
      } catch (error) {
         console.error(error);
      } finally {
         setIsProcessing(false);
      }
    }
  };

  const handleDuplicateCourse = async () => {
    if (courseToDuplicate) {
      setIsProcessing(true);
      try {
        await courseService.duplicateCourse(courseToDuplicate);
        toast.success("Curso duplicado com sucesso!");
        await loadData();
        setCourseToDuplicate(null);
      } catch (error) {
        console.error("Erro ao duplicar curso:", error);
        toast.error("Erro ao duplicar o curso. Verifique o console.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleManageContent = (course: OnlineCourse) => {
    setManagingCourse(course);
  };

  // Helper para obter subcategorias da categoria selecionada
  const activeCategory = categories.find(c => c.id === selectedCategory);
  const currentSubcategories = activeCategory ? activeCategory.subcategories : [];

  // RENDERIZAÇÃO CONDICIONAL: GERENCIADOR DE CONTEÚDO
  if (managingCourse) {
    return (
      <CourseContentManager 
        course={managingCourse} 
        onBack={() => {
          setManagingCourse(null);
          loadData(); // Recarrega dados ao voltar para refletir mudanças
        }} 
      />
    );
  }

  // RENDERIZAÇÃO PADRÃO: LISTA DE CURSOS
  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* --- HEADER E AÇÕES --- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
            CURSOS <span className="text-red-600">ONLINE</span>
          </h2>
          <p className="text-gray-400 text-sm">Gerencie suas turmas e conteúdos de videoaulas.</p>
        </div>
        
        <div className="flex items-center gap-3">
            {/* Botão Gerenciar Categorias */}
            <button 
                onClick={() => setIsCategoryManagerOpen(true)}
                className="px-4 py-3 bg-[#1a1d24] hover:bg-[#202329] text-gray-300 font-bold uppercase text-xs rounded border border-gray-800 transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                Gerenciar Categorias
            </button>

            {/* Botão Novo Curso */}
            <button 
                onClick={() => { setEditingCourse(null); setIsModalOpen(true); }}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded shadow-lg shadow-red-900/20 transition-all flex items-center gap-2"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Criar Novo Curso
            </button>
        </div>
      </div>

      {/* --- BARRA DE FILTRAGEM --- */}
      <div className="bg-[#121418] p-2 rounded-xl border border-gray-800 flex flex-col md:flex-row gap-2 items-center">
        
        {/* Label Filtros */}
        <div className="flex items-center gap-2 px-3 text-gray-500 font-bold text-xs uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            Filtros:
        </div>

        {/* Select Categoria */}
        <div className="relative min-w-[200px]">
            <select
                value={selectedCategory}
                onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubcategory(''); // Resetar subcategoria ao trocar categoria
                }}
                className="w-full bg-black border border-gray-800 rounded px-3 py-2.5 text-xs text-white focus:border-red-600 outline-none appearance-none font-medium uppercase"
            >
                <option value="">Todas as Categorias</option>
                {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-gray-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>

        {/* Select Subcategoria */}
        <div className="relative min-w-[200px]">
            <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                disabled={!selectedCategory}
                className="w-full bg-black border border-gray-800 rounded px-3 py-2.5 text-xs text-white focus:border-red-600 outline-none appearance-none font-medium uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <option value="">Todas as Subcategorias</option>
                {currentSubcategories.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                ))}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-gray-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>

        {/* Input de Pesquisa */}
        <div className="flex-1 relative w-full">
          <svg className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="BUSCAR POR ÓRGÃO OU TÍTULO..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-gray-800 rounded pl-9 p-2.5 text-xs text-white focus:border-red-600 outline-none uppercase font-medium placeholder-gray-600"
          />
        </div>
      </div>

      {/* --- GRID DE CURSOS --- */}
      {loading ? (
        <div className="flex justify-center py-20">
           <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
          <p className="text-gray-500">Nenhum curso encontrado com os filtros atuais.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredCourses.map(course => (
            <CourseCard 
              key={course.id} 
              course={course} 
              onEdit={(c) => { setEditingCourse(c); setIsModalOpen(true); }}
              onManage={handleManageContent}
              onDelete={setCourseToDelete}
              onDuplicate={setCourseToDuplicate}
            />
          ))}
        </div>
      )}

      {/* --- MODAIS --- */}
      
      {/* Modal de Criação/Edição de Curso */}
      <CourseModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCourse}
        initialData={editingCourse}
      />

      {/* Modal de Gerenciamento de Categorias */}
      <CategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => {
            setIsCategoryManagerOpen(false);
            loadData();
        }}
        categories={categories}
        refreshData={loadData}
      />

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal 
        isOpen={!!courseToDelete}
        title="Excluir Curso?"
        message={`Tem certeza que deseja excluir "${courseToDelete?.title}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteCourse}
        onClose={() => setCourseToDelete(null)}
        variant="danger"
        isLoading={isProcessing}
      />

      {/* Modal de Confirmação de Duplicação */}
      <ConfirmationModal 
        isOpen={!!courseToDuplicate}
        title="Duplicar Curso?"
        message={`Deseja criar uma cópia de "${courseToDuplicate?.title}"?`}
        confirmText="Sim, Duplicar"
        onConfirm={handleDuplicateCourse}
        onClose={() => setCourseToDuplicate(null)}
        variant="primary"
        isLoading={isProcessing}
      />

    </div>
  );
}
