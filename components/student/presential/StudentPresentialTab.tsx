import React, { useState, useEffect } from 'react';
import { Search, Filter, Loader2, GraduationCap } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { classService } from '../../../services/classService';
import { classMetadataService, MetadataItem } from '../../../services/classMetadataService';
import { Class } from '../../../types/class';
import { StudentPresentialCard } from './StudentPresentialCard';

export function StudentPresentialTab() {
  const { userData } = useAuth();
  
  // Estados de Dados
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [categories, setCategories] = useState<MetadataItem[]>([]);
  const [subcategories, setSubcategories] = useState<MetadataItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');

  // 1. Carregar e Filtrar Dados
  useEffect(() => {
    const loadData = async () => {
        if (!userData || !userData.access) {
            setLoading(false);
            return;
        }

        try {
            // Busca dados do sistema
            const [allClasses, allCategories, allSubcategories] = await Promise.all([
                classService.getClasses(),
                classMetadataService.getCategories(),
                classMetadataService.getSubcategories()
            ]);

            // LÓGICA CRUCIAL: Filtrar apenas turmas que o usuário tem acesso
            // O user.access contém itens { type: 'presential_class', targetId: '...', isActive: true }
            const myAccess = userData.access
                .filter((a: any) => a.type === 'presential_class' && a.isActive);
            
            const myAccessIds = myAccess.map((a: any) => a.targetId);

            const allowedClasses = allClasses
                .filter(cls => myAccessIds.includes(cls.id))
                .map(cls => {
                    // Descobre o índice original no array de acessos do aluno para espelhar a ordem de cadastro
                    const accessIndex = userData.access.findIndex((a: any) => 
                        a.targetId === cls.id && a.type === 'presential_class' && a.isActive
                    );
                    const access = userData.access[accessIndex];
                    
                    return { 
                        ...cls, 
                        grantedAt: access?.createdAt || access?.grantedAt,
                        orderIndex: access?.orderIndex || 0,
                        accessIndex: accessIndex !== -1 ? accessIndex : 999
                    };
                })
                .sort((a, b) => a.accessIndex - b.accessIndex);

            setMyClasses(allowedClasses);
            setFilteredClasses(allowedClasses);
            setCategories(allCategories);
            setSubcategories(allSubcategories);
        } catch (error) {
            console.error("Erro ao carregar turmas presenciais do aluno:", error);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [userData]);

  // 2. Lógica de Filtragem (Pesquisa/Categoria)
  useEffect(() => {
    const results = myClasses.filter(cls => {
      // Filtro de Texto (Nome ou Órgão)
      const matchesSearch = 
        cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cls.organization && cls.organization.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filtro de Categoria (Comparando ID ou Nome, dependendo de como foi salvo na Class. 
      // Na interface Class, category é string. Assumindo que salva o ID ou Nome. 
      // O Admin salva o ID geralmente. Vamos verificar se bate com o ID da categoria)
      const matchesCategory = selectedCategory ? cls.category === selectedCategory : true;
      
      // Filtro de Subcategoria
      const matchesSubcategory = selectedSubcategory ? cls.subcategory === selectedSubcategory : true;

      return matchesSearch && matchesCategory && matchesSubcategory;
    });
    setFilteredClasses(results);
  }, [searchTerm, selectedCategory, selectedSubcategory, myClasses]);

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <Loader2 size={40} className="animate-spin text-emerald-600" />
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Carregando suas turmas...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      
      {/* Título */}
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">
            Turmas <span className="text-emerald-600">Presenciais</span>
        </h2>
        <p className="text-zinc-400 text-sm font-medium">
            Acesse suas turmas presenciais e materiais exclusivos.
        </p>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-[#121418] p-3 rounded-xl border border-zinc-800 flex flex-col md:flex-row gap-3 items-center shadow-lg">
        
        <div className="flex items-center gap-2 px-3 text-zinc-500 font-bold text-xs uppercase tracking-wider shrink-0">
            <Filter size={16} />
            Filtros:
        </div>

        {/* Select Categoria */}
        <div className="relative w-full md:w-auto min-w-[200px]">
            <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); }}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white focus:border-emerald-600 outline-none uppercase font-bold appearance-none cursor-pointer"
            >
                <option value="">Todas as Categorias</option>
                {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-zinc-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>

        {/* Select Subcategoria */}
        <div className="relative w-full md:w-auto min-w-[200px]">
            <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white focus:border-emerald-600 outline-none uppercase font-bold appearance-none cursor-pointer"
            >
                <option value="">Todas as Subcategorias</option>
                {subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-zinc-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>

        {/* Campo de Busca */}
        <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input 
                type="text" 
                placeholder="BUSCAR POR NOME OU ÓRGÃO..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg pl-9 p-2.5 text-xs text-white focus:border-emerald-600 outline-none uppercase font-bold placeholder-zinc-700"
            />
        </div>
      </div>

      {/* Grid de Resultados */}
      {filteredClasses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 text-center">
            <div className="bg-zinc-800 p-4 rounded-full mb-4 text-zinc-500">
                <GraduationCap size={32} />
            </div>
            <h3 className="text-zinc-300 font-bold uppercase text-lg">Nenhuma turma encontrada</h3>
            <p className="text-zinc-500 text-xs mt-2 max-w-md">
                {myClasses.length === 0 
                    ? "Você ainda não possui turmas presenciais liberadas em sua conta. Entre em contato com a secretaria." 
                    : "Tente ajustar os filtros de busca para encontrar o que procura."}
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredClasses.map(cls => (
                <StudentPresentialCard 
                    key={cls.id} 
                    classData={cls} 
                    // onClick={() => {}} // Futuramente abrirá detalhes
                />
            ))}
        </div>
      )}
    </div>
  );
}
