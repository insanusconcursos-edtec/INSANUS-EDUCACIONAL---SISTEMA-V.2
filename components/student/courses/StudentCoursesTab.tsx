import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search, Filter, Loader2, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { courseService } from '../../../services/courseService';
import { getCategories, Category } from '../../../services/planService';
import { getProducts } from '../../../services/productService';
import { OnlineCourse } from '../../../types/course';
import { TictoProduct } from '../../../types/product';
import { StudentCourseCard } from './StudentCourseCard';
import { CourseDetails } from './CourseDetails';
import CheckoutModal from '../checkout/CheckoutModal';
import { useStudyContext } from '../../../contexts/StudyContext';

export function StudentCoursesTab() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const { userData } = useAuth();
  const { setCurrentProduct } = useStudyContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [myCourses, setMyCourses] = useState<OnlineCourse[]>([]);
  const [availableProducts, setAvailableProducts] = useState<TictoProduct[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<OnlineCourse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<OnlineCourse | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<TictoProduct | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  // Update current product for support
  useEffect(() => {
    if (selectedCourse) {
      setCurrentProduct({
        type: 'curso_online',
        id: selectedCourse.id,
        name: selectedCourse.title
      });
    } else {
      setCurrentProduct(null);
    }
    return () => setCurrentProduct(null);
  }, [selectedCourse, setCurrentProduct]);

  // 1. Carregar e Filtrar Dados
  useEffect(() => {
    const loadData = async () => {
        if (!userData || !userData.access) {
            setLoading(false);
            return;
        }

        try {
            // Busca dados do sistema
            const [allCourses, allCategories, allProducts] = await Promise.all([
                courseService.getCourses(),
                getCategories(),
                getProducts()
            ]);

            // LÓGICA CRUCIAL: Filtrar apenas cursos que o usuário tem acesso
            const myAccessIds = (userData.access || [])
                .filter((a: any) => a.type === 'course' && a.isActive)
                .map((a: any) => a.targetId);

            const allowedCourses = allCourses
                .filter(course => myAccessIds.includes(course.id))
                .map(course => {
                    const accessIndex = userData.access.findIndex((a: any) => 
                        a.targetId === course.id && a.type === 'course' && a.isActive
                    );
                    const access = userData.access[accessIndex];
                    
                    // Fallback logic for dates
                    const startDate = access?.diaInicio || access?.startDate || access?.grantedAt || access?.createdAt || access?.starts_at || access?.startsAt;
                    const endDate = access?.diaFim || access?.endDate || access?.expiresAt || access?.expires_at || access?.finishedAt;
                    const grantedAt = access?.createdAt || access?.grantedAt || access?.diaInicio || access?.startsAt;

                    return { 
                        ...course, 
                        grantedAt,
                        startDate,
                        endDate,
                        orderIndex: access?.orderIndex || 0,
                        accessIndex: accessIndex !== -1 ? accessIndex : 999,
                        isScholarship: access?.isScholarship || false
                    };
                })
                .sort((a, b) => a.accessIndex - b.accessIndex);

            // Filtrar produtos que o usuário ainda NÃO tem e que dão acesso a cursos
            const unownedProducts = allProducts.filter(product => {
                // Se algum curso do produto não está nos acessos do usuário
                const productCourseIds = product.linkedResources.onlineCourses || [];
                return productCourseIds.length > 0 && productCourseIds.some(cid => !myAccessIds.includes(cid));
            });

            setMyCourses(allowedCourses);
            setAvailableProducts(unownedProducts);
            setFilteredCourses(allowedCourses);
            setCategories(allCategories);
        } catch (error) {
            console.error("Erro ao carregar cursos do aluno:", error);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [userData]);

  // 1.1. Lógica para abrir curso via URL
  useEffect(() => {
    if (courseId && myCourses.length > 0) {
      const course = myCourses.find(c => c.id === courseId);
      if (course) {
        setSelectedCourse(course);
      }
    }

    // Checkout direto via link de oferta
    const productIdParam = searchParams.get('productId');
    const offerIdParam = searchParams.get('offerId');

    if (productIdParam && availableProducts.length > 0) {
      const product = availableProducts.find(p => p.id === productIdParam);
      if (product) {
        setCheckoutProduct(product);
        if (offerIdParam) {
          setSelectedOfferId(offerIdParam);
        }
      }
    }
  }, [courseId, myCourses, availableProducts, searchParams]);

  // 2. Lógica de Filtragem (Pesquisa/Categoria)
  useEffect(() => {
    const results = myCourses.filter(course => {
      // Filtro de Texto (Nome ou Órgão)
      const matchesSearch = 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.organization && course.organization.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filtro de Categoria
      const matchesCategory = selectedCategory ? course.categoryId === selectedCategory : true;
      
      // Filtro de Subcategoria
      const matchesSubcategory = selectedSubcategory ? course.subcategoryId === selectedSubcategory : true;

      return matchesSearch && matchesCategory && matchesSubcategory;
    });
    setFilteredCourses(results);
  }, [searchTerm, selectedCategory, selectedSubcategory, myCourses]);

  // Helper para subcategorias do select
  const activeCategoryObj = categories.find(c => c.id === selectedCategory);
  const currentSubcategories = activeCategoryObj ? activeCategoryObj.subcategories : [];

    if (selectedCourse) {
      return (
          <CourseDetails 
              course={selectedCourse} 
              onBack={() => setSelectedCourse(null)} 
          />
      );
    }

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <Loader2 size={40} className="animate-spin text-red-600" />
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Carregando seus cursos...</p>
        </div>
    );
  }

  // Grid de Resultados
  const regularCourses = filteredCourses.filter(c => c.type === 'REGULAR' || !c.type);
  const isolatedCourses = filteredCourses.filter(c => c.type === 'ISOLADO');

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8 animate-in fade-in pb-20">
      
      {/* Título */}
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">
            Cursos <span className="text-red-600">Online</span>
        </h2>
        <p className="text-zinc-400 text-sm font-medium">
            Acesse suas videoaulas e materiais exclusivos.
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
                onChange={(e) => { setSelectedCategory(e.target.value); setSelectedSubcategory(''); }}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white focus:border-red-600 outline-none uppercase font-bold appearance-none cursor-pointer"
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
                disabled={!selectedCategory}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white focus:border-red-600 outline-none uppercase font-bold appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <option value="">Todas as Subcategorias</option>
                {currentSubcategories.map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
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
                className="w-full bg-black border border-zinc-800 rounded-lg pl-9 p-2.5 text-xs text-white focus:border-red-600 outline-none uppercase font-bold placeholder-zinc-700"
            />
        </div>
      </div>

      {/* Grid de Resultados */}
      {filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 text-center">
            <div className="bg-zinc-800 p-4 rounded-full mb-4 text-zinc-500">
                <PlayCircle size={32} />
            </div>
            <h3 className="text-zinc-300 font-bold uppercase text-lg">Nenhum curso encontrado</h3>
            <p className="text-zinc-500 text-xs mt-2 max-w-md">
                {myCourses.length === 0 
                    ? "Você ainda não possui cursos liberados em sua conta. Entre em contato com o suporte." 
                    : "Tente ajustar os filtros de busca para encontrar o que procura."}
            </p>
        </div>
      ) : (
        <div className="space-y-12">
            {/* Seção Cursos Regulares */}
            {regularCourses.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-1 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Cursos <span className="text-red-600">Regulares</span></h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {regularCourses.map(course => {
                            const isMaintenance = course.maintenanceMode?.enabled && !course.maintenanceMode?.whitelistedUsers?.includes(userData?.email || '');
                            return (
                                <StudentCourseCard 
                                    key={course.id} 
                                    course={course} 
                                    isMaintenance={isMaintenance}
                                    onClick={() => setSelectedCourse(course)}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Seção Cursos Isolados */}
            {isolatedCourses.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-1 bg-zinc-600 rounded-full"></div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Cursos <span className="text-zinc-500">Isolados</span></h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {isolatedCourses.map(course => {
                            const isMaintenance = course.maintenanceMode?.enabled && !course.maintenanceMode?.whitelistedUsers?.includes(userData?.email || '');
                            return (
                                <StudentCourseCard 
                                    key={course.id} 
                                    course={course} 
                                    isMaintenance={isMaintenance}
                                    onClick={() => setSelectedCourse(course)}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SEÇÃO DA LOJA (Produtos não adquiridos) */}
            {availableProducts.length > 0 && (
                <div className="space-y-6 pt-12 border-t border-zinc-900">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-1 bg-gradient-to-b from-yellow-500 to-amber-600 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)]"></div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Expandir <span className="text-amber-500">Biblioteca</span></h3>
                        </div>
                        <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-3 py-1 rounded border border-amber-500/20 uppercase tracking-widest">
                            {availableProducts.length} pacotes disponíveis
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {availableProducts.map(product => {
                            const defaultOffer = product.offers?.find(o => o.isDefault);
                            return (
                                <StudentCourseCard 
                                    key={product.id} 
                                    course={product} 
                                    isLocked={true}
                                    price={defaultOffer?.price || product.price}
                                    onClick={(p) => {
                                        setCheckoutProduct(p);
                                        setSelectedOfferId(null);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* MODAL DE CHECKOUT */}
      {checkoutProduct && (
          <CheckoutModal 
              product={checkoutProduct}
              offerId={selectedOfferId}
              onClose={() => {
                  setCheckoutProduct(null);
                  setSelectedOfferId(null);
              }}
              onSuccess={() => {
                  // O webhook vai liberar, mas podemos dar um feedback ou refresh
                  window.location.reload();
              }}
          />
      )}
    </div>
  );
}