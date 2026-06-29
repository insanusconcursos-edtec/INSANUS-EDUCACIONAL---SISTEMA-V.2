import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Clock, Trash2, Plus, 
  CheckCircle, Layers, GraduationCap,
  Loader2, PlayCircle, Users, Radio,
  ArrowLeft, Package, Shield, Globe, Monitor, MapPin, Fingerprint
} from 'lucide-react';
import { 
  Student, 
  AccessItem, 
  grantStudentAccess, 
  revokeStudentAccess, 
  extendStudentAccess,
  getStudentById
} from '../../../services/userService';
import { getPlans, Plan } from '../../../services/planService';
import { getSimulatedClasses, SimulatedClass } from '../../../services/simulatedService';
import { courseService } from '../../../services/courseService';
import { classService } from '../../../services/classService';
import { liveEventService } from '../../../services/liveEventService';
import { Class } from '../../../types/class';
import { OnlineCourse } from '../../../types/course';
import { LiveEvent } from '../../../types/liveEvent';
import { TictoProduct } from '../../../types/product';
import { db } from '../../../services/firebase';
import { doc, writeBatch, Timestamp, collection, getDocs } from 'firebase/firestore';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { toast } from 'react-hot-toast';

interface StudentAccessManagerProps {
  student: Student;
  onClose: () => void;
  onUpdate: () => void; // Trigger refresh on parent
}

type ModalType = 'ADD_PLAN' | 'ADD_SIMULADO' | 'ADD_COURSE' | 'ADD_PRESENTIAL' | 'ADD_LIVE_EVENT' | 'ADD_PRODUCT' | 'EXTEND' | null;

const StudentAccessManager: React.FC<StudentAccessManagerProps> = ({ student: initialStudent, onClose, onUpdate }) => {
  // State
  const [localStudent, setLocalStudent] = useState<Student>(initialStudent);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [simClasses, setSimClasses] = useState<SimulatedClass[]>([]);
  const [courses, setCourses] = useState<OnlineCourse[]>([]);
  const [presentialClasses, setPresentialClasses] = useState<Class[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [availableProducts, setAvailableProducts] = useState<TictoProduct[]>([]);
  
  // Modal State
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState('');
  const [daysInput, setDaysInput] = useState<number>(30);
  const [targetAccessId, setTargetAccessId] = useState<string | null>(null); // For extension
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScholarship, setIsScholarship] = useState(false);

  // Revoke Modal State
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [accessToRevoke, setAccessToRevoke] = useState<AccessItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // === DATA FETCHING ===

  // 1. Fetch Plans, Classes and Courses
  useEffect(() => {
    const loadContent = async () => {
      try {
        const [p, s, c, pc, le, prodSnap] = await Promise.all([
          getPlans(),
          getSimulatedClasses(),
          courseService.getCourses(),
          classService.getClasses(),
          liveEventService.getLiveEvents(),
          getDocs(collection(db, 'ticto_products'))
        ]);
        setPlans(p);
        setSimClasses(s);
        setCourses(c);
        setPresentialClasses(pc);
        setLiveEvents(le.filter(e => e.isIsolatedProduct));
        setAvailableProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TictoProduct)));
      } catch (error) {
        console.error("Error loading content:", error);
      }
    };
    loadContent();
  }, []);

  // 2. Fetch Latest Student Data (Refresh Logic)
  const fetchStudentData = useCallback(async () => {
    if (!initialStudent.uid) return;
    try {
        const freshData = await getStudentById(initialStudent.uid);
        if (freshData) {
            setLocalStudent(freshData);
        }
    } catch (error) {
        console.error("Erro ao atualizar dados do aluno:", error);
    }
  }, [initialStudent.uid]);

  // Initial fetch to ensure sync
  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  // 3. Fetch Session Logs (Anti-piracy)
  const fetchSessions = useCallback(async () => {
    if (!localStudent.uid) return;
    setIsLoadingSessions(true);
    try {
      const response = await fetch(`/api/admin/students/${localStudent.uid}/sessions`);
      const data = await response.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error("Erro ao carregar sessões:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [localStudent.uid]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // === HELPERS ===
  const ensureDate = (val: any): Date | null => {
    if (!val) return null;
    
    // 1. Firebase Timestamp (Object with toDate method)
    if (typeof val.toDate === 'function') return val.toDate();
    
    // 2. Date Object
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    
    // 3. ISO String or Date String
    if (typeof val === 'string' && val.trim() !== '') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    
    // 4. Plain object with seconds or _seconds (from JSON or Admin SDK)
    if (typeof val === 'object') {
      if (val.seconds !== undefined) return new Date(val.seconds * 1000);
      if (val._seconds !== undefined) return new Date(val._seconds * 1000);
    }

    return null;
  };

  const getDaysRemaining = (diaFim: any, altEnd?: any) => {
    const end = ensureDate(diaFim) || ensureDate(altEnd);
    if (!end) return 0;
    
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const calculateProgress = (start: any, end: any, altStart?: any, altEnd?: any) => {
    const sDate = ensureDate(start) || ensureDate(altStart);
    const eDate = ensureDate(end) || ensureDate(altEnd);
    if (!sDate || !eDate) return 0;
    
    const s = sDate.getTime();
    const e = eDate.getTime();
    const now = new Date().getTime();
    
    if (e <= s) return 100;
    
    const total = e - s;
    const elapsed = now - s;
    
    if (elapsed < 0) return 0;
    if (elapsed > total) return 100;
    return (elapsed / total) * 100;
  };

  const getAccessStatus = (diaInicio: any, diaFim: any, altStart?: any, altEnd?: any) => {
    const start = ensureDate(diaInicio) || ensureDate(altStart);
    const end = ensureDate(diaFim) || ensureDate(altEnd);
    
    if (!start || !end) return 'EXPIRADO';
    
    const now = new Date();

    if (now > end) return 'EXPIRADO';
    if (now >= start && now <= end) return 'ATIVO';
    if (now < start) return 'AGUARDANDO';
    
    return 'EXPIRADO';
  };

  const formatDate = (val: any, altVal?: any) => {
    const date = ensureDate(val) || ensureDate(altVal);
    if (!date) return '---';
    return date.toLocaleDateString('pt-BR');
  };

  // === ACTIONS ===
  const handleGrant = async () => {
    if (!selectedContentId || !daysInput) return;
    setIsProcessing(true);
    
    try {
      if (activeModal === 'ADD_PRODUCT') {
        await handleGrantProduct();
        return;
      }

      let title = '';
      let type: 'plan' | 'simulated_class' | 'course' | 'presential_class' | 'live_events' = 'plan';

      if (activeModal === 'ADD_PLAN') {
        type = 'plan';
        const p = plans.find(x => x.id === selectedContentId);
        title = p?.title || 'Plano Desconhecido';
      } else if (activeModal === 'ADD_SIMULADO') {
        type = 'simulated_class';
        const s = simClasses.find(x => x.id === selectedContentId);
        title = s?.title || 'Turma Desconhecida';
      } else if (activeModal === 'ADD_COURSE') {
        type = 'course';
        const c = courses.find(x => x.id === selectedContentId);
        title = c?.title || 'Curso Desconhecido';
      } else if (activeModal === 'ADD_PRESENTIAL') {
        type = 'presential_class';
        const pc = presentialClasses.find(x => x.id === selectedContentId);
        title = pc?.name || 'Turma Presencial Desconhecida';
      } else if (activeModal === 'ADD_LIVE_EVENT') {
        type = 'live_events';
        const le = liveEvents.find(x => x.id === selectedContentId);
        title = le?.title || 'Evento Desconhecido';
      }

      await grantStudentAccess(localStudent.uid, {
        type,
        targetId: selectedContentId,
        title,
        days: daysInput,
        isScholarship: (activeModal === 'ADD_PRESENTIAL' || activeModal === 'ADD_COURSE' || activeModal === 'ADD_PLAN') ? isScholarship : false
      });

      toast.success("Acesso liberado com sucesso!");
      await fetchStudentData(); // Immediate Refresh
      onUpdate(); // Notify Parent
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao liberar acesso.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGrantProduct = async () => {
    try {
      const product = availableProducts.find(p => p.id === selectedContentId);
      if (!product) throw new Error("Produto não encontrado");

      const batch = writeBatch(db);
      const userRef = doc(db, 'users', localStudent.uid);

      const diaInicio = new Date();
      const diaFim = new Date();
      diaFim.setDate(diaInicio.getDate() + daysInput);

      const startTimestamp = Timestamp.fromDate(diaInicio);
      const endTimestamp = Timestamp.fromDate(diaFim);

      // 1. Adiciona o Produto na lista do aluno
      const productAccessId = crypto.randomUUID();
      const newProductAccess: AccessItem = {
        id: productAccessId,
        type: 'product',
        targetId: product.id!,
        title: product.name,
        days: daysInput,
        diaInicio: startTimestamp,
        diaFim: endTimestamp,
        isActive: true
      };

      const currentProducts = localStudent.products || [];
      const updatedProducts = [...currentProducts, newProductAccess];

      // 2. Provisionamento em lote dos recursos vinculados
      const currentAccess = [...(localStudent.access || [])];

      // Helper to add access item
      const addAccess = (type: AccessItem['type'], targetId: string, title: string) => {
        currentAccess.push({
          id: crypto.randomUUID(),
          type,
          targetId,
          title,
          days: daysInput,
          diaInicio: startTimestamp,
          diaFim: endTimestamp,
          isActive: true,
          sourceProductId: productAccessId // Vincula ao produto pai
        });
      };

      // Linked Plans
      if (product.linkedResources?.plans) {
        for (const planId of product.linkedResources.plans) {
          const plan = plans.find(p => p.id === planId);
          if (plan) addAccess('plan', planId, plan.title);
        }
      }

      // Linked Courses
      if (product.linkedResources?.onlineCourses) {
        for (const courseId of product.linkedResources.onlineCourses) {
          const course = courses.find(c => c.id === courseId);
          if (course) addAccess('course', courseId, course.title);
        }
      }

      // Linked Simulated
      if (product.linkedResources?.simulated) {
        for (const simId of product.linkedResources.simulated) {
          const sim = simClasses.find(s => s.id === simId);
          if (sim) addAccess('simulated_class', simId, sim.title);
        }
      }

      // Linked Presentials
      if (product.linkedResources?.presentialClasses) {
        for (const presId of product.linkedResources.presentialClasses) {
          const pres = presentialClasses.find(p => p.id === presId);
          if (pres) addAccess('presential_class', presId, pres.name);
        }
      }

      batch.update(userRef, {
        products: updatedProducts,
        access: currentAccess
      });

      await batch.commit();
      toast.success("Produto liberado com sucesso!");
      await fetchStudentData();
      onUpdate();
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao liberar produto.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestRevoke = (access: AccessItem) => {
    setAccessToRevoke(access);
    setRevokeModalOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!accessToRevoke) return;
    setIsRevoking(true);
    try {
        await revokeStudentAccess(localStudent.uid, accessToRevoke.id);
        toast.success("Acesso revogado com sucesso!");
        await fetchStudentData(); // Immediate Refresh
        onUpdate(); // Notify Parent
        setRevokeModalOpen(false);
        setAccessToRevoke(null);
    } catch (error) {
        console.error(error);
        toast.error("Erro ao revogar.");
    } finally {
        setIsRevoking(false);
    }
  };

  const openExtendModal = (accessId: string) => {
    setTargetAccessId(accessId);
    setDaysInput(30);
    setActiveModal('EXTEND');
  };

  const handleExtend = async () => {
    if (!targetAccessId) return;
    setIsProcessing(true);
    try {
        await extendStudentAccess(localStudent.uid, targetAccessId, daysInput);
        toast.success("Acesso estendido com sucesso!");
        await fetchStudentData(); // Immediate Refresh
        onUpdate(); // Notify Parent
        closeModal();
    } catch (error) {
        console.error("Erro ao estender prazo:", error);
        toast.error("Erro ao estender prazo.");
    } finally {
        setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedContentId('');
    setDaysInput(30);
    setTargetAccessId(null);
    setIsScholarship(false);
  };

  // Filtering existing access
  const productAccessFromProducts = localStudent.products?.filter(a => a.isActive) || [];
  const productAccessFromAccess = localStudent.access?.filter(a => a.type === 'product' && a.isActive) || [];
  const productAccess = [...productAccessFromProducts, ...productAccessFromAccess];

  const planAccess = localStudent.access?.filter(a => a.type === 'plan' && a.isActive) || [];
  const simAccess = localStudent.access?.filter(a => a.type === 'simulated_class' && a.isActive) || [];
  const courseAccess = localStudent.access?.filter(a => a.type === 'course' && a.isActive) || [];
  const presentialAccess = localStudent.access?.filter(a => a.type === 'presential_class' && a.isActive) || [];
  const liveEventAccess = localStudent.access?.filter(a => a.type === 'live_events' && a.isActive) || [];

  return (
    <div className="fixed inset-0 z-40 bg-gray-950 pt-[120px] pb-12 overflow-y-auto custom-scrollbar">
      
      <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col relative min-h-full">
        
        {/* Header with Back Button */}
        <div className="flex items-center gap-6 mb-8 border-b border-gray-800 pb-6">
            <button 
                onClick={onClose}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition font-bold text-sm uppercase px-4 py-2 bg-gray-900 rounded-lg hover:bg-gray-800"
            >
                <ArrowLeft size={18} />
                Voltar aos Alunos
            </button>

            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-red flex items-center justify-center text-white font-black text-lg border-2 border-zinc-950 shadow-lg">
                    {(localStudent.name || '??').substring(0, 2)}
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                        {localStudent.name || 'Aluno sem nome'}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-bold uppercase tracking-widest">
                        <span>{localStudent.email || 'Email não informado'}</span>
                        <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                        <span>CPF: {localStudent.cpf || '---'}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-x-auto flex gap-6 pb-4 w-full snap-x custom-scrollbar">
            
            {/* COLUMN 0: PRODUCTS (PURPLE) */}
            <div className="flex flex-col min-w-[320px] snap-start border border-zinc-900 bg-zinc-900/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-purple-500">
                        <Package size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Produtos (Combos)</span>
                    </div>
                    <button 
                        onClick={() => setActiveModal('ADD_PRODUCT')}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Liberar Produto
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {productAccess.length === 0 ? (
                        <EmptyState text="Nenhum produto ativo" icon={Package} />
                    ) : (
                        productAccess.map(access => (
                            <AccessCard 
                                key={access.id} 
                                access={access} 
                                colorClass="purple"
                                onRevoke={() => handleRequestRevoke(access)}
                                onExtend={() => openExtendModal(access.id)}
                                getDaysRemaining={getDaysRemaining}
                                calculateProgress={calculateProgress}
                                getAccessStatus={getAccessStatus}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* COLUMN 1: PLANS (RED) */}
            <div className="flex flex-col min-w-[320px] snap-start border border-zinc-900 bg-zinc-900/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-red-500">
                        <Layers size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Planos de Estudo</span>
                    </div>
                    <button 
                        onClick={() => setActiveModal('ADD_PLAN')}
                        className="px-4 py-2 bg-brand-red hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-red-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Liberar Plano
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {planAccess.length === 0 ? (
                        <EmptyState text="Nenhum plano ativo" icon={Layers} />
                    ) : (
                        planAccess.map(access => (
                            <AccessCard 
                                key={access.id} 
                                access={access} 
                                colorClass="red"
                                onRevoke={() => handleRequestRevoke(access)}
                                onExtend={() => openExtendModal(access.id)}
                                getDaysRemaining={getDaysRemaining}
                                calculateProgress={calculateProgress}
                                getAccessStatus={getAccessStatus}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* COLUMN 2: SIMULATED (ORANGE) */}
            <div className="flex flex-col min-w-[320px] snap-start border border-zinc-900 bg-zinc-900/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-orange-500">
                        <GraduationCap size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Turmas de Simulados</span>
                    </div>
                    <button 
                        onClick={() => setActiveModal('ADD_SIMULADO')}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Liberar Turma
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {simAccess.length === 0 ? (
                        <EmptyState text="Nenhuma turma ativa" icon={GraduationCap} />
                    ) : (
                        simAccess.map(access => (
                            <AccessCard 
                                key={access.id} 
                                access={access} 
                                colorClass="orange"
                                onRevoke={() => handleRequestRevoke(access)}
                                onExtend={() => openExtendModal(access.id)}
                                getDaysRemaining={getDaysRemaining}
                                calculateProgress={calculateProgress}
                                getAccessStatus={getAccessStatus}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* COLUMN 3: COURSES (BLUE) */}
            <div className="flex flex-col min-w-[320px] snap-start border border-zinc-900 bg-zinc-900/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-blue-500">
                        <PlayCircle size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Cursos Online</span>
                    </div>
                    <button 
                        onClick={() => setActiveModal('ADD_COURSE')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Liberar Curso
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {courseAccess.length === 0 ? (
                        <EmptyState text="Nenhum curso ativo" icon={PlayCircle} />
                    ) : (
                        courseAccess.map(access => (
                            <AccessCard 
                                key={access.id} 
                                access={access} 
                                colorClass="blue"
                                onRevoke={() => handleRequestRevoke(access)}
                                onExtend={() => openExtendModal(access.id)}
                                getDaysRemaining={getDaysRemaining}
                                calculateProgress={calculateProgress}
                                getAccessStatus={getAccessStatus}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* COLUMN 4: PRESENTIAL (EMERALD) */}
            <div className="flex flex-col min-w-[320px] snap-start border border-zinc-900 bg-zinc-900/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-emerald-500">
                        <Users size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Turmas Presenciais</span>
                    </div>
                    <button 
                        onClick={() => setActiveModal('ADD_PRESENTIAL')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Liberar Turma
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {presentialAccess.length === 0 ? (
                        <EmptyState text="Nenhuma turma ativa" icon={Users} />
                    ) : (
                        presentialAccess.map(access => (
                            <AccessCard 
                                key={access.id} 
                                access={access} 
                                colorClass="emerald"
                                onRevoke={() => handleRequestRevoke(access)}
                                onExtend={() => openExtendModal(access.id)}
                                getDaysRemaining={getDaysRemaining}
                                calculateProgress={calculateProgress}
                                getAccessStatus={getAccessStatus}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* COLUMN 5: LIVE EVENTS (YELLOW) */}
            <div className="flex flex-col min-w-[320px] snap-start border border-zinc-900 bg-zinc-900/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-yellow-500">
                        <Radio size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Eventos Ao Vivo</span>
                    </div>
                    <button 
                        onClick={() => setActiveModal('ADD_LIVE_EVENT')}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-yellow-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Liberar Evento
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {liveEventAccess.length === 0 ? (
                        <EmptyState text="Nenhum evento ativo" icon={Radio} />
                    ) : (
                        liveEventAccess.map(access => (
                            <AccessCard 
                                key={access.id} 
                                access={access} 
                                colorClass="yellow"
                                onRevoke={() => handleRequestRevoke(access)}
                                onExtend={() => openExtendModal(access.id)}
                                getDaysRemaining={getDaysRemaining}
                                calculateProgress={calculateProgress}
                                getAccessStatus={getAccessStatus}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* COLUMN 6: SESSION HISTORY (ANTI-PIRACY) */}
            <div className="flex flex-col min-w-[350px] snap-start border border-emerald-900/30 bg-emerald-900/5 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-emerald-900/30 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-emerald-500">
                        <Shield size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Histórico de Acessos</span>
                    </div>
                    <button 
                        onClick={fetchSessions}
                        className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Atualizar Logs"
                    >
                        <Loader2 size={16} className={isLoadingSessions ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {sessions.length === 0 ? (
                        <EmptyState text="Nenhum acesso registrado" icon={Shield} />
                    ) : (
                        sessions.map(session => (
                            <SessionCard key={session.id} session={session} />
                        ))
                    )}
                </div>
            </div>

        </div>
      </div>

      {/* MODAL: ADD / EXTEND ACCESS */}
      {activeModal && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={closeModal}>
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" onMouseDown={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                        {activeModal === 'EXTEND' ? 'Estender Prazo' : 'Liberar Acesso'}
                    </h3>
                    <button onClick={closeModal} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    {activeModal !== 'EXTEND' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                Selecione o Conteúdo
                            </label>
                            <select 
                                value={selectedContentId}
                                onChange={e => setSelectedContentId(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-brand-red uppercase"
                            >
                                <option value="">Selecione...</option>
                                {activeModal === 'ADD_PLAN' 
                                    ? plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)
                                    : activeModal === 'ADD_PRODUCT'
                                        ? availableProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                                        : activeModal === 'ADD_SIMULADO'
                                        ? simClasses.map(s => <option key={s.id} value={s.id}>{s.title}</option>)
                                        : activeModal === 'ADD_COURSE'
                                            ? courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)
                                            : activeModal === 'ADD_LIVE_EVENT'
                                                ? liveEvents.map(le => <option key={le.id} value={le.id}>{le.title}</option>)
                                                : presentialClasses.map(pc => <option key={pc.id} value={pc.id}>{pc.name}</option>)
                                }
                            </select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {activeModal === 'EXTEND' ? 'Dias Adicionais' : 'Dias de Acesso'}
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {[30, 60, 90, 365].map(d => (
                                <button 
                                    key={d}
                                    onClick={() => setDaysInput(d)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${daysInput === d ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                        <div className="relative mt-2">
                            <Clock size={16} className="absolute left-3 top-3 text-zinc-600" />
                            <input 
                                type="number"
                                value={daysInput}
                                onChange={e => setDaysInput(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand-red"
                            />
                        </div>
                    </div>

                    {(activeModal === 'ADD_PRESENTIAL' || activeModal === 'ADD_COURSE' || activeModal === 'ADD_PLAN') && (
                      <div className="flex items-center gap-3 mt-4 mb-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                        <input
                          type="checkbox"
                          id="scholarship-checkbox"
                          checked={isScholarship}
                          onChange={(e) => setIsScholarship(e.target.checked)}
                          className="w-4 h-4 text-red-600 bg-gray-900 border-gray-600 rounded focus:ring-red-500 focus:ring-2"
                        />
                        <label htmlFor="scholarship-checkbox" className="text-sm font-medium text-gray-300 cursor-pointer">
                          Este acesso é uma Bolsa de Estudos (100% Gratuito)
                        </label>
                      </div>
                    )}

                    <button 
                        onClick={activeModal === 'EXTEND' ? handleExtend : handleGrant}
                        disabled={isProcessing || (activeModal !== 'EXTEND' && !selectedContentId)}
                        className="w-full py-4 mt-2 bg-brand-red hover:bg-red-600 text-white font-black uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle size={16} />}
                        {activeModal === 'EXTEND' ? 'Confirmar Extensão' : 'Liberar Acesso'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* CONFIRMATION MODAL (Revoke) */}
      <ConfirmationModal 
        isOpen={revokeModalOpen}
        onClose={() => setRevokeModalOpen(false)}
        onConfirm={handleConfirmRevoke}
        title="Revogar Acesso?"
        message={
          accessToRevoke?.type === 'product' 
            ? `Tem certeza que deseja remover o COMBO "${accessToRevoke?.title}"? Isso revogará AUTOMATICAMENTE todos os cursos, planos e turmas vinculados a este produto. Esta ação não pode ser desfeita.`
            : `Tem certeza que deseja remover o acesso do aluno ao conteúdo: "${accessToRevoke?.title}"? Esta ação não pode ser desfeita.`
        }
        isLoading={isRevoking}
      />

    </div>
  );
};

// --- SUB-COMPONENTS ---

const EmptyState = ({ text, icon: Icon }: { text: string; icon: React.ElementType }) => (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-600 border-2 border-dashed border-zinc-800/50 rounded-xl p-8">
        <Icon size={32} className="opacity-50" />
        <span className="text-xs font-black uppercase tracking-wide">{text}</span>
    </div>
);

interface AccessItemExtended extends AccessItem {
    [key: string]: any;
}

interface AccessCardProps {
    access: AccessItemExtended;
    colorClass: string;
    onRevoke: () => void;
    onExtend: () => void;
    getDaysRemaining: (diaFim: any, altEnd?: any) => number;
    calculateProgress: (start: any, end: any, altStart?: any, altEnd?: any) => number;
    getAccessStatus: (start: any, end: any, altStart?: any, altEnd?: any) => string;
    formatDate: (val: any, altVal?: any) => string;
}

const AccessCard = ({ access, colorClass, onRevoke, onExtend, getDaysRemaining, calculateProgress, getAccessStatus, formatDate }: AccessCardProps) => {
    // Check multiple names for compatibility
    const diaInicio = access.diaInicio || access.startDate || access.grantedAt || access.createdAt || (access as any).starts_at;
    const diaFim = access.diaFim || access.endDate || access.expiresAt || (access as any).expires_at || (access as any).finishedAt;

    const daysLeft = getDaysRemaining(access.diaFim, diaFim);
    const progress = calculateProgress(access.diaInicio, access.diaFim, diaInicio, diaFim);
    const status = getAccessStatus(access.diaInicio, access.diaFim, diaInicio, diaFim);
    
    // Color setup
    let colors = {
        border: 'border-zinc-800',
        text: 'text-zinc-500',
        bg: 'bg-zinc-500',
        barBg: 'bg-zinc-900'
    };

    if (colorClass === 'red') {
        colors = { border: 'border-red-600/30 hover:border-red-600/60', text: 'text-red-500', bg: 'bg-red-600', barBg: 'bg-red-900/20' };
    } else if (colorClass === 'purple') {
        colors = { border: 'border-purple-600/30 hover:border-purple-600/60', text: 'text-purple-400', bg: 'bg-purple-600', barBg: 'bg-purple-900/20' };
    } else if (colorClass === 'orange') {
        colors = { border: 'border-orange-500/30 hover:border-orange-500/60', text: 'text-orange-400', bg: 'bg-orange-500', barBg: 'bg-orange-900/20' };
    } else if (colorClass === 'blue') {
        colors = { border: 'border-blue-500/30 hover:border-blue-500/60', text: 'text-blue-400', bg: 'bg-blue-500', barBg: 'bg-blue-900/20' };
    } else if (colorClass === 'emerald') {
        colors = { border: 'border-emerald-500/30 hover:border-emerald-500/60', text: 'text-emerald-400', bg: 'bg-emerald-500', barBg: 'bg-emerald-900/20' };
    } else if (colorClass === 'yellow') {
        colors = { border: 'border-yellow-500/30 hover:border-yellow-500/60', text: 'text-yellow-400', bg: 'bg-yellow-500', barBg: 'bg-yellow-900/20' };
    }

    return (
        <div className={`group relative bg-zinc-950 border ${colors.border} p-4 rounded-xl transition-all shadow-sm`} title={access.title}>
            <div className="flex justify-between items-start mb-3 gap-2">
                <h4 
                    className="text-sm font-black text-white uppercase tracking-tight line-clamp-3 pr-4 break-words"
                    title={access.title}
                >
                    {access.title}
                </h4>
                <div className="flex items-center gap-2 shrink-0">
                    <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${status === 'ATIVO' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-red-500/30 text-red-500 bg-red-500/10'}`}>
                        {status}
                    </div>
                    {access.isScholarship && (
                        <span className="bg-blue-900/50 text-blue-400 border border-blue-800 text-[10px] font-bold px-2 py-0.5 rounded shrink-0">
                            BOLSISTA
                        </span>
                    )}
                </div>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 font-mono uppercase tracking-wide mb-3">
                <div>
                    <span className="block text-zinc-600 font-bold mb-0.5">Dia Início</span>
                    {formatDate(access.diaInicio, diaInicio)}
                </div>
                <div className="text-right">
                    <span className="block text-zinc-600 font-bold mb-0.5">Dia Fim</span>
                    {formatDate(access.diaFim, diaFim)}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-bold uppercase">
                    <span className={colors.text}>{daysLeft} dias restantes</span>
                    <span className="text-zinc-600">{Math.round(progress)}% Concluído</span>
                </div>
                <div className={`h-1.5 w-full ${colors.barBg} rounded-full overflow-hidden`}>
                    <div 
                        className={`h-full ${colors.bg} rounded-full transition-all duration-500`} 
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>

            {/* Actions (Hover) */}
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/80 backdrop-blur-sm rounded-lg border border-zinc-800 p-1">
                <button 
                    onClick={onExtend}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                    title="Estender Prazo"
                >
                    <Plus size={14} />
                </button>
                <button 
                    onClick={onRevoke}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-900/20 rounded transition-colors"
                    title="Revogar Acesso"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

const SessionCard = ({ session }: { session: any }) => {
    const date = session.createdAt ? (session.createdAt.toDate ? session.createdAt.toDate() : new Date(session.timestamp)) : new Date(session.timestamp);
    
    return (
        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-3 hover:border-emerald-500/30 transition-all group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-500">
                    <Globe size={14} />
                    <span className="text-xs font-mono font-bold">{session.ip}</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase">
                    {date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            {/* Fingerprint Badge */}
            {session.fingerprint && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-md">
                    <Fingerprint size={12} className="text-purple-500" />
                    <span className="text-[9px] font-mono text-zinc-400 truncate" title={session.fingerprint}>
                        ID: {session.fingerprint}
                    </span>
                </div>
            )}

            {/* Browser Geolocation (GPS) */}
            {session.browserGeo && session.browserGeo.lat && (
                <a 
                    href={`https://www.google.com/maps?q=${session.browserGeo.lat},${session.browserGeo.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-brand-red/5 border border-brand-red/10 rounded-lg hover:bg-brand-red/10 transition-colors"
                >
                    <MapPin size={14} className="text-brand-red" />
                    <div className="flex-1">
                        <div className="text-[10px] text-white font-black uppercase tracking-tight">GPS: Ver no Mapa</div>
                        <div className="text-[9px] text-zinc-500 font-bold">Precisão: {Math.round(session.browserGeo.accuracy)}m</div>
                    </div>
                </a>
            )}

            {/* IP Geolocation (Fallback) */}
            {session.geo && (session.geo.status === 'success' || session.geo.country) && (
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 space-y-1">
                    <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1">
                        {session.geo.city || 'Desconhecido'}, {session.geo.regionName || session.geo.region || ''} - {session.geo.countryCode || session.geo.country || ''}
                    </div>
                    <div className="text-[9px] text-zinc-500 font-bold uppercase truncate">
                        {session.geo.isp || session.geo.org || 'ISP Desconhecido'}
                    </div>
                </div>
            )}

            <div className="flex items-start gap-2 pt-1 border-t border-zinc-900">
                <Monitor size={12} className="text-zinc-600 mt-0.5 shrink-0" />
                <div className="text-[9px] text-zinc-500 font-medium leading-tight line-clamp-2 italic">
                    {session.userAgent}
                </div>
            </div>
        </div>
    );
};

export default StudentAccessManager;
