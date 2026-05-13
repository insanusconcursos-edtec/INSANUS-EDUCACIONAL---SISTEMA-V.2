
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Settings, Filter, Search } from 'lucide-react';
import { getPlans, getCategories, Plan, Category, deletePlan, createPlan, duplicatePlan } from '../../services/planService';
import PlanCard from '../../components/admin/PlanCard';
import PlanForm from '../../components/admin/PlanForm';
import CategoryManager from '../../components/admin/CategoryManager';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate Modal State
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [planToDuplicate, setPlanToDuplicate] = useState<Plan | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Stable fetch function
  const fetchData = useCallback(async () => {
    try {
      const [fetchedPlans, fetchedCats] = await Promise.all([
        getPlans(),
        getCategories()
      ]);
      setPlans(fetchedPlans);
      setCategories(fetchedCats);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Request to delete (Open Modal)
  const handleDeleteRequest = (plan: Plan) => {
    setPlanToDelete(plan);
    setIsDeleteModalOpen(true);
  };

  // Confirm Delete Action
  const confirmDelete = async () => {
    if (!planToDelete?.id) return;
    
    setIsDeleting(true);
    try {
        await deletePlan(planToDelete.id);
        
        // Optimistic update or refetch
        setPlans(current => current.filter(p => p.id !== planToDelete.id));
        
        // Close modal
        setIsDeleteModalOpen(false);
        setPlanToDelete(null);
    } catch (error) {
        console.error("Erro ao excluir plano:", error);
        alert("Não foi possível excluir o plano.");
    } finally {
        setIsDeleting(false);
    }
  };

  // === DUPLICATE LOGIC ===

  const handleRequestDuplicate = (plan: Plan, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlanToDuplicate(plan);
    setDuplicateModalOpen(true);
  };

  const handleConfirmDuplicate = async () => {
    if (!planToDuplicate?.id) return;

    setIsDuplicating(true);
    try {
        // Call the robust Deep Copy service
        await duplicatePlan(planToDuplicate.id);
        
        // Refresh list to show the new copy
        await fetchData();
        
        setDuplicateModalOpen(false);
        setPlanToDuplicate(null);
    } catch (error) {
        console.error("Erro ao duplicar:", error);
        alert("Erro ao duplicar o plano. Verifique o console.");
    } finally {
        setIsDuplicating(false);
    }
  };

  const openNewPlan = () => {
    setEditingPlan(null);
    setIsFormOpen(true);
  };

  const openEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setIsFormOpen(true);
  };

  // Filter Logic
  const filteredPlans = plans.filter(plan => {
    const matchCat = filterCategory ? plan.category === filterCategory : true;
    const matchSub = filterSubcategory ? plan.subcategory === filterSubcategory : true;
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = searchTerm 
        ? plan.title.toLowerCase().includes(searchLower) || plan.organ.toLowerCase().includes(searchLower)
        : true;
    return matchCat && matchSub && matchSearch;
  });

  const activeCategoryObj = categories.find(c => c.name === filterCategory);
  const availableSubcategories = activeCategoryObj ? activeCategoryObj.subcategories : [];

  if (loading && !isDeleting && !isDuplicating) {
    return (
        <div className="flex items-center justify-center h-full min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-red"></div>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Planos de Estudo</h2>
          <div className="w-12 h-1 bg-brand-red shadow-[0_0_15px_rgba(255,0,0,0.5)]"></div>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsCatManagerOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black uppercase text-zinc-400 hover:text-white hover:border-zinc-600 transition-all tracking-widest"
            >
                <Settings size={14} />
                Gerenciar Categorias
            </button>
            <button 
                onClick={openNewPlan}
                className="flex items-center gap-2 px-8 py-3 bg-brand-red rounded-lg text-[10px] font-black uppercase text-white shadow-lg shadow-brand-red/30 hover:bg-red-600 hover:scale-[1.02] transition-all tracking-widest"
            >
                <Plus size={14} strokeWidth={3} />
                Novo Plano
            </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-1 bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <Filter size={14} />
            <span>Filtros:</span>
        </div>
        
        <select 
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setFilterSubcategory(''); }}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[180px]"
        >
            <option value="">TODAS AS CATEGORIAS</option>
            {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
        </select>
        
        <select 
            value={filterSubcategory}
            onChange={(e) => setFilterSubcategory(e.target.value)}
            disabled={!filterCategory}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[180px] disabled:opacity-50"
        >
            <option value="">TODAS AS SUBCATEGORIAS</option>
            {availableSubcategories.map((sub, idx) => (
                <option key={idx} value={sub}>{sub}</option>
            ))}
        </select>
        
        <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search size={14} className="text-zinc-600" />
            </div>
            <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="BUSCAR POR ÓRGÃO OU TÍTULO..."
                className="w-full bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white pl-10 pr-4 py-2.5 placeholder-zinc-700 focus:outline-none focus:border-brand-red transition-all uppercase"
            />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filteredPlans.map(plan => (
              <PlanCard 
                  key={plan.id} 
                  plan={plan} 
                  onEdit={openEditPlan}
                  onDelete={handleDeleteRequest} 
                  onDuplicate={handleRequestDuplicate}
              />
          ))}
          
          <button 
              onClick={openNewPlan}
              className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800/50 rounded-2xl p-8 hover:border-brand-red/30 hover:bg-zinc-900/10 transition-all group min-h-[300px]"
          >
              <div className="w-14 h-14 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 group-hover:text-brand-red group-hover:border-brand-red/30 group-hover:shadow-[0_0_20px_rgba(255,0,0,0.1)] transition-all mb-6">
                  <Plus size={24} />
              </div>
              <span className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-white transition-colors tracking-[0.2em]">Criar Novo Plano</span>
          </button>
      </div>

      {/* Empty State */}
      {filteredPlans.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/20 rounded-2xl border border-zinc-800/30">
              <h3 className="text-xl font-black text-zinc-700 uppercase">Nenhum plano encontrado</h3>
              <p className="text-zinc-600 text-xs mt-2">Tente ajustar os filtros ou crie um novo plano.</p>
          </div>
      )}

      {/* Modals */}
      <PlanForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        planToEdit={editingPlan}
        categories={categories}
        refreshData={fetchData}
      />
      
      <CategoryManager 
        isOpen={isCatManagerOpen}
        onClose={() => setIsCatManagerOpen(false)}
        categories={categories}
        refreshData={fetchData}
      />

      {/* Delete Modal */}
      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Plano"
        message={`Você tem certeza que deseja excluir o plano "${planToDelete?.title}"? Esta ação é irreversível.`}
        confirmText="Excluir Plano"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Duplicate Modal */}
      <ConfirmationModal 
        isOpen={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
        onConfirm={handleConfirmDuplicate}
        title="Duplicar Plano"
        message={`Você está prestes a criar uma cópia completa do plano "${planToDuplicate?.title}", incluindo todas as disciplinas, assuntos, pastas e configurações internas. Isso pode levar alguns segundos.`}
        confirmText="Duplicar Agora"
        variant="primary"
        isLoading={isDuplicating}
      />
    </div>
  );
};

export default PlansPage;
