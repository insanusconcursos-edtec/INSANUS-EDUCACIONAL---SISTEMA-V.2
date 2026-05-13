
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { Filter, Search, ChevronRight } from 'lucide-react';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { SimulatedClass } from '../../../services/simulatedService';

interface StudentSimulatedListProps {
  onSelectClass: (cls: SimulatedClass) => void;
}

export const StudentSimulatedList: React.FC<StudentSimulatedListProps> = ({ onSelectClass }) => {
    const { userData } = useAuth();
    const [classes, setClasses] = useState<SimulatedClass[]>([]);
    const [loading, setLoading] = useState(true);

    // Estados dos Filtros
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('TODAS');
    const [subCategory, setSubCategory] = useState('TODAS');
    const [orgao, setOrgao] = useState('');

    // Estados para as Listas de Opções (IDs presentes nas turmas)
    const [availableCategoryIds, setAvailableCategoryIds] = useState<string[]>([]);
    const [availableSubCategories, setAvailableSubCategories] = useState<string[]>([]);

    // Estados para "Traduzir" ID -> Nome
    const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            // Aguarda userData carregar
            if (userData === undefined) return; 

            try {
                // 1. Busca todas as turmas (simulatedClasses)
                const qClasses = query(collection(db, 'simulatedClasses'));
                const snapClasses = await getDocs(qClasses);
                const allData = snapClasses.docs.map(d => ({ id: d.id, ...d.data() } as SimulatedClass));

                // 2. Busca as Categorias (Para pegar os nomes reais)
                // O sistema usa a coleção 'categories' para armazenar metadados dos planos/simulados
                const qCats = query(collection(db, 'categories')); 
                const snapCats = await getDocs(qCats);
                
                const catMap: Record<string, string> = {};
                snapCats.docs.forEach(doc => {
                    const data = doc.data();
                    // Mapeia ID -> Nome
                    catMap[doc.id] = data.name || doc.id;
                });
                setCategoryMap(catMap);

                // 3. Filtra por permissão (Lógica Robusta Adaptada ao Schema do Projeto)
                const allowed = allData
                    .map(turma => {
                        // Descobre o índice original no array de acessos do aluno para espelhar a ordem de cadastro
                        const accessIndex = userData?.access?.findIndex(a => 
                            a.type === 'simulated_class' && 
                            a.targetId === turma.id && 
                            a.isActive
                        );
                        const access = accessIndex !== undefined && accessIndex !== -1 ? userData.access[accessIndex] : null;

                        return { 
                            ...turma, 
                            grantedAt: access?.createdAt || access?.grantedAt,
                            orderIndex: access?.orderIndex || 0,
                            accessIndex: accessIndex !== undefined && accessIndex !== -1 ? accessIndex : 999,
                            hasAccess: !!access || (turma as any).public === true
                        };
                    })
                    .filter(t => t.hasAccess)
                    .sort((a, b) => a.accessIndex - b.accessIndex);

                setClasses(allowed);

                // 4. Extrai IDs/Values Únicos para os Filtros
                const uniqueCatIds = Array.from(new Set(allowed.map(c => c.categoryId).filter(Boolean))).sort();
                setAvailableCategoryIds(uniqueCatIds);

                const uniqueSubNames = Array.from(new Set(allowed.map(c => c.subcategoryId).filter(Boolean))).sort();
                setAvailableSubCategories(uniqueSubNames);

            } catch (err) {
                console.error("Erro ao buscar simulados:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userData]);

    // Lógica de Filtragem Visual
    const filtered = classes.filter(c => {
        const matchSearch = c.title?.toLowerCase().includes(search.toLowerCase());
        
        // Mapeamento exato baseado nos filtros dinâmicos
        const matchCat = category === 'TODAS' || c.categoryId === category;
        const matchSub = subCategory === 'TODAS' || c.subcategoryId === subCategory;
        
        const matchOrgao = orgao === '' || c.organization?.toLowerCase().includes(orgao.toLowerCase());
        
        return matchSearch && matchCat && matchSub && matchOrgao;
    });

    // Função auxiliar para pegar o nome bonito
    const getCategoryName = (id: string) => {
        return categoryMap[id] || id; // Retorna o Nome se achar, ou o ID se não achar
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* --- 1. BARRA DE FERRAMENTAS (DESIGN COMPLEXO) --- */}
            <div className="bg-[#1a1d24] border border-gray-800 p-5 rounded-2xl shadow-xl flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex items-center gap-2 text-gray-400 font-bold text-xs uppercase tracking-widest border-r border-gray-700 pr-6 mr-2">
                    <Filter className="w-5 h-5 text-red-500" />
                    Filtros Avançados
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 w-full">
                    {/* Select Categoria (TRADUZIDO ID -> NOME) */}
                    <div className="relative">
                        <select 
                            value={category} 
                            onChange={e => setCategory(e.target.value)} 
                            className="w-full bg-gray-900 text-gray-300 text-sm font-semibold py-2.5 px-4 rounded-lg border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all cursor-pointer uppercase appearance-none"
                        >
                            <option value="TODAS">TODAS AS CATEGORIAS</option>
                            {availableCategoryIds.map(catId => (
                                <option key={catId} value={catId}>
                                    {getCategoryName(catId).toUpperCase()}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    {/* Select Subcategoria */}
                    <div className="relative">
                        <select 
                            value={subCategory} 
                            onChange={e => setSubCategory(e.target.value)} 
                            className="w-full bg-gray-900 text-gray-300 text-sm font-semibold py-2.5 px-4 rounded-lg border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all cursor-pointer uppercase appearance-none"
                        >
                            <option value="TODAS">TODAS SUBCATEGORIAS</option>
                            {availableSubCategories.map(s => (
                                <option key={s} value={s}>{s.toUpperCase()}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    {/* Input Órgão */}
                    <input 
                        type="text" 
                        placeholder="Filtrar por Órgão (Ex: PC-SP)" 
                        value={orgao}
                        onChange={e => setOrgao(e.target.value)}
                        className="bg-gray-900 text-white text-sm py-2.5 px-4 rounded-lg border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none placeholder-gray-600"
                    />

                    {/* Input Busca */}
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                        <input 
                            type="text" 
                            placeholder="Buscar turma..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-gray-900 text-white text-sm py-2.5 pl-10 pr-4 rounded-lg border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none placeholder-gray-600"
                        />
                    </div>
                </div>
            </div>

            {/* --- 2. GRID DE TURMAS (DESIGN PREMIUM) --- */}
            {loading ? (
                <div className="text-center py-20 text-gray-500 animate-pulse font-bold uppercase tracking-widest text-xs">Carregando turmas autorizadas...</div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-50 border-2 border-dashed border-gray-800 rounded-2xl">
                    <div className="p-4 bg-gray-900 rounded-full mb-4">
                        <Search className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-xl font-bold text-gray-400">Nenhuma turma encontrada.</p>
                    <p className="text-sm text-gray-600 mt-2 font-medium">Verifique os filtros ou adquira um novo plano.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filtered.map(turma => (
                        <div 
                            key={turma.id}
                            onClick={() => onSelectClass(turma)}
                            className="group relative bg-[#15171b] rounded-2xl border border-gray-800 hover:border-red-600/50 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-red-900/10 hover:-translate-y-1 flex flex-col h-full"
                        >
                            {/* IMAGEM: Aspect Square + Object Cover */}
                            <div className="relative w-full aspect-square overflow-hidden bg-gray-900">
                                {turma.coverUrl ? (
                                    <img 
                                        src={turma.coverUrl} 
                                        alt={turma.title} 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100 grayscale-[0.2] group-hover:grayscale-0"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-gray-700">
                                        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className="text-xs font-bold uppercase tracking-widest">Sem Capa</span>
                                    </div>
                                )}
                                
                                {/* Overlay Gradiente */}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#15171b] via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                                {/* Tags Flutuantes */}
                                <div className="absolute top-4 left-4 flex flex-col gap-2 items-start">
                                    {turma.organization && (
                                        <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded shadow-lg uppercase tracking-wider backdrop-blur-sm">
                                            {turma.organization}
                                        </span>
                                    )}
                                    <span className="bg-black/60 text-gray-300 border border-gray-600/50 text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md uppercase">
                                        {getCategoryName(turma.categoryId)}
                                    </span>
                                </div>
                            </div>

                            {/* Conteúdo do Card */}
                            <div className="p-5 flex flex-col flex-1 relative z-10 border-t border-gray-800/50">
                                <h3 className="text-lg font-bold text-white leading-tight mb-2 group-hover:text-red-500 transition-colors line-clamp-2 min-h-[3rem]">
                                    {turma.title}
                                </h3>
                                
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate">
                                        {turma.subcategoryId || 'Simulados'}
                                    </span>
                                </div>

                                <div className="mt-auto pt-4 border-t border-gray-800/50">
                                    <button className="w-full py-3 rounded-lg bg-gray-800 group-hover:bg-red-600 text-gray-300 group-hover:text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg">
                                        <span>Acessar Simulados</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
