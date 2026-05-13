import React, { useState, useEffect, useMemo } from 'react';
import { X, Upload, Check, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { LiveEvent, LiveEventAccessControl } from '../../../types/liveEvent';
import { getPlans } from '../../../services/planService';
import { courseService } from '../../../services/courseService';
import { classService } from '../../../services/classService';
import { getSimulatedClasses } from '../../../services/simulatedService';

interface LiveEventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LiveEvent, thumbnailFile?: File) => Promise<void>;
  initialData?: LiveEvent | null;
}

export const LiveEventFormModal: React.FC<LiveEventFormModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [timezoneLocation, setTimezoneLocation] = useState('Brasília/DF');
  const [isIsolatedProduct, setIsIsolatedProduct] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  
  const [accessControl, setAccessControl] = useState<LiveEventAccessControl>({
    plans: [],
    onlineCourses: [],
    presentialClasses: [],
    simulated: []
  });

  const [loading, setLoading] = useState(false);
  
  // Search states
  const [searchPlan, setSearchPlan] = useState('');
  const [searchCourse, setSearchCourse] = useState('');
  const [searchClass, setSearchClass] = useState('');
  const [searchSimulated, setSearchSimulated] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('plans');
  
  // Data for selects
  const [plans, setPlans] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [simulated, setSimulated] = useState<any[]>([]);

  // Filtered data
  const filteredPlans = useMemo(() => {
    if (!searchPlan) return plans;
    const term = searchPlan.toLowerCase();
    return plans.filter(p => 
      (p.title || p.name || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term)
    );
  }, [plans, searchPlan]);

  const filteredCourses = useMemo(() => {
    if (!searchCourse) return courses;
    const term = searchCourse.toLowerCase();
    return courses.filter(c => 
      (c.title || c.name || '').toLowerCase().includes(term) ||
      (c.category || '').toLowerCase().includes(term)
    );
  }, [courses, searchCourse]);

  const filteredClasses = useMemo(() => {
    if (!searchClass) return classes;
    const term = searchClass.toLowerCase();
    return classes.filter(c => 
      (c.title || c.name || '').toLowerCase().includes(term) ||
      (c.category || '').toLowerCase().includes(term)
    );
  }, [classes, searchClass]);

  const filteredSimulated = useMemo(() => {
    if (!searchSimulated) return simulated;
    const term = searchSimulated.toLowerCase();
    return simulated.filter(s => 
      (s.title || s.name || '').toLowerCase().includes(term) ||
      (s.category || '').toLowerCase().includes(term)
    );
  }, [simulated, searchSimulated]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (initialData) {
        setTitle(initialData.title);
        setSubtitle(initialData.subtitle || '');
        setEventDate(initialData.eventDate);
        setStartTime(initialData.startTime);
        setTimezoneLocation(initialData.timezoneLocation || 'Brasília/DF');
        setIsIsolatedProduct(initialData.isIsolatedProduct);
        setAccessControl(initialData.accessControl);
        setThumbnailPreview(initialData.thumbnailUrl || '');
      } else {
        resetForm();
      }
    }
  }, [isOpen, initialData]);

  const loadData = async () => {
    try {
      const [plansData, coursesData, classesData, simulatedData] = await Promise.all([
        getPlans(),
        courseService.getCourses(),
        classService.getClasses(),
        getSimulatedClasses()
      ]);
      setPlans(plansData);
      setCourses(coursesData);
      setClasses(classesData);
      setSimulated(simulatedData);
    } catch (error) {
      console.error("Error loading access control data:", error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setSubtitle('');
    setEventDate('');
    setStartTime('');
    setTimezoneLocation('Brasília/DF');
    setIsIsolatedProduct(false);
    setThumbnailFile(null);
    setThumbnailPreview('');
    setAccessControl({
      plans: [],
      onlineCourses: [],
      presentialClasses: [],
      simulated: []
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const toggleAccess = (type: keyof LiveEventAccessControl, id: string) => {
    setAccessControl(prev => {
      const currentList = prev[type];
      if (currentList.includes(id)) {
        return { ...prev, [type]: currentList.filter(itemId => itemId !== id) };
      } else {
        return { ...prev, [type]: [...currentList, id] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const eventData: LiveEvent = {
        ...(initialData?.id ? { id: initialData.id } : {}),
        title,
        subtitle,
        eventDate,
        startTime,
        timezoneLocation,
        isIsolatedProduct,
        accessControl,
        status: initialData?.status || 'scheduled',
        thumbnailUrl: initialData?.thumbnailUrl || ''
      };
      
      await onSave(eventData, thumbnailFile || undefined);
      onClose();
    } catch (error) {
      console.error("Error saving live event:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-[120px] inset-x-0 bottom-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl">
        
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'EDITAR EVENTO AO VIVO' : 'AGENDAR EVENTO AO VIVO'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="live-event-form" onSubmit={handleSubmit} className="space-y-8">
            
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-red-500 border-b border-zinc-800 pb-2">Informações Básicas</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Título do Evento *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                    placeholder="Ex: Aulão de Véspera"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Subtítulo (Opcional)</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                    placeholder="Ex: Flashcard Final de Direito Penal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Data do Evento *</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Horário de Início *</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Fuso Horário de Referência *</label>
                  <select
                    required
                    value={timezoneLocation}
                    onChange={(e) => setTimezoneLocation(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Brasília/DF">Brasília/DF (Horário Padrão)</option>
                    <option value="Porto Velho/RO">Porto Velho/RO</option>
                    <option value="Rio Branco/AC">Rio Branco/AC</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Capa do Evento */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-red-500 border-b border-zinc-800 pb-2">Capa do Evento (1920x1080)</h3>
              <div className="flex items-center gap-6">
                <div className="w-64 h-36 bg-black border-2 border-dashed border-zinc-700 rounded-xl overflow-hidden flex items-center justify-center relative group">
                  {thumbnailPreview ? (
                    <>
                      <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-medium">Trocar Imagem</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-zinc-500">
                      <Upload size={24} className="mb-2" />
                      <span className="text-xs">Fazer Upload</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 text-sm text-zinc-400">
                  <p>A capa será exibida na listagem de eventos e na sala de espera.</p>
                  <p className="mt-2">Recomendamos imagens na proporção 16:9 (1920x1080 pixels) para melhor visualização.</p>
                </div>
              </div>
            </div>

            {/* Configurações de Venda */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-red-500 border-b border-zinc-800 pb-2">Configurações de Produto</h3>
              <label className="flex items-center gap-3 cursor-pointer p-4 bg-black border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors" onClick={() => setIsIsolatedProduct(!isIsolatedProduct)}>
                <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${isIsolatedProduct ? 'bg-red-600 border-red-600' : 'border-zinc-600 bg-zinc-900'}`}>
                  {isIsolatedProduct && <Check size={16} className="text-white" />}
                </div>
                <div>
                  <span className="block text-white font-medium">Vender como Produto Isolado</span>
                  <span className="block text-xs text-zinc-500 mt-0.5">Permite liberar o acesso a este evento individualmente no cadastro do aluno.</span>
                </div>
              </label>
            </div>

            {/* Controle de Acesso */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h3 className="text-lg font-semibold text-red-500">Controle de Acesso (Recursos Vinculados)</h3>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Selecionado:</span>
                  <span className="text-[10px] font-bold text-white bg-zinc-800 px-2 py-0.5 rounded">
                    {accessControl.plans.length + accessControl.onlineCourses.length + accessControl.presentialClasses.length + accessControl.simulated.length}
                  </span>
                </div>
              </div>
              <p className="text-sm text-zinc-400">Selecione quais recursos darão acesso automático a este evento ao vivo.</p>
              
              <div className="space-y-3">
                {/* Planos */}
                <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'plans' ? null : 'plans')}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-white font-medium uppercase tracking-wider text-xs">Planos de Estudo</span>
                      <span className="bg-emerald-500/20 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {accessControl.plans.length}
                      </span>
                    </div>
                    {expandedSection === 'plans' ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
                  </button>

                  {expandedSection === 'plans' && (
                    <div className="p-4 border-t border-zinc-800 space-y-4 bg-zinc-900/20">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                        <input
                          type="text"
                          value={searchPlan}
                          onChange={(e) => setSearchPlan(e.target.value)}
                          placeholder="Pesquisar planos..."
                          className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {filteredPlans.map(plan => (
                          <label key={plan.id} className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-800/50 transition-colors" onClick={(e) => { e.preventDefault(); toggleAccess('plans', plan.id); }}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${accessControl.plans.includes(plan.id) ? 'bg-red-600 border-red-600' : 'border-zinc-600 bg-zinc-900 group-hover:border-zinc-500'}`}>
                              {accessControl.plans.includes(plan.id) && <Check size={14} className="text-white" />}
                            </div>
                            <span className="text-xs text-zinc-300 group-hover:text-white transition-colors truncate">
                              {plan.title || plan.name || 'Sem nome definido'}
                            </span>
                          </label>
                        ))}
                        {filteredPlans.length === 0 && (
                          <p className="text-xs text-zinc-600 italic py-4 text-center col-span-2">
                            {searchPlan ? 'Nenhum plano encontrado para esta busca.' : 'Nenhum plano cadastrado.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cursos Online */}
                <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'courses' ? null : 'courses')}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-white font-medium uppercase tracking-wider text-xs">Cursos Online</span>
                      <span className="bg-blue-500/20 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {accessControl.onlineCourses.length}
                      </span>
                    </div>
                    {expandedSection === 'courses' ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
                  </button>

                  {expandedSection === 'courses' && (
                    <div className="p-4 border-t border-zinc-800 space-y-4 bg-zinc-900/20">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                        <input
                          type="text"
                          value={searchCourse}
                          onChange={(e) => setSearchCourse(e.target.value)}
                          placeholder="Pesquisar cursos..."
                          className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {filteredCourses.map(course => (
                          <label key={course.id} className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-800/50 transition-colors" onClick={(e) => { e.preventDefault(); toggleAccess('onlineCourses', course.id); }}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${accessControl.onlineCourses.includes(course.id) ? 'bg-red-600 border-red-600' : 'border-zinc-600 bg-zinc-900 group-hover:border-zinc-500'}`}>
                              {accessControl.onlineCourses.includes(course.id) && <Check size={14} className="text-white" />}
                            </div>
                            <span className="text-xs text-zinc-300 group-hover:text-white transition-colors truncate">
                              {course.title || course.name || 'Sem nome definido'}
                            </span>
                          </label>
                        ))}
                        {filteredCourses.length === 0 && (
                          <p className="text-xs text-zinc-600 italic py-4 text-center col-span-2">
                            {searchCourse ? 'Nenhum curso encontrado para esta busca.' : 'Nenhum curso cadastrado.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Turmas Presenciais */}
                <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'classes' ? null : 'classes')}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span className="text-white font-medium uppercase tracking-wider text-xs">Turmas Presenciais</span>
                      <span className="bg-purple-500/20 text-purple-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {accessControl.presentialClasses.length}
                      </span>
                    </div>
                    {expandedSection === 'classes' ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
                  </button>

                  {expandedSection === 'classes' && (
                    <div className="p-4 border-t border-zinc-800 space-y-4 bg-zinc-900/20">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                        <input
                          type="text"
                          value={searchClass}
                          onChange={(e) => setSearchClass(e.target.value)}
                          placeholder="Pesquisar turmas..."
                          className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {filteredClasses.map(cls => (
                          <label key={cls.id} className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-800/50 transition-colors" onClick={(e) => { e.preventDefault(); toggleAccess('presentialClasses', cls.id); }}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${accessControl.presentialClasses.includes(cls.id) ? 'bg-red-600 border-red-600' : 'border-zinc-600 bg-zinc-900 group-hover:border-zinc-500'}`}>
                              {accessControl.presentialClasses.includes(cls.id) && <Check size={14} className="text-white" />}
                            </div>
                            <span className="text-xs text-zinc-300 group-hover:text-white transition-colors truncate">
                              {cls.title || cls.name || 'Sem nome definido'}
                            </span>
                          </label>
                        ))}
                        {filteredClasses.length === 0 && (
                          <p className="text-xs text-zinc-600 italic py-4 text-center col-span-2">
                            {searchClass ? 'Nenhuma turma encontrada para esta busca.' : 'Nenhuma turma cadastrada.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Simulados */}
                <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'simulated' ? null : 'simulated')}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <span className="text-white font-medium uppercase tracking-wider text-xs">Turmas de Simulados</span>
                      <span className="bg-orange-500/20 text-orange-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {accessControl.simulated.length}
                      </span>
                    </div>
                    {expandedSection === 'simulated' ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
                  </button>

                  {expandedSection === 'simulated' && (
                    <div className="p-4 border-t border-zinc-800 space-y-4 bg-zinc-900/20">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                        <input
                          type="text"
                          value={searchSimulated}
                          onChange={(e) => setSearchSimulated(e.target.value)}
                          placeholder="Pesquisar simulados..."
                          className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {filteredSimulated.map(sim => (
                          <label key={sim.id} className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-800/50 transition-colors" onClick={(e) => { e.preventDefault(); toggleAccess('simulated', sim.id); }}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${accessControl.simulated.includes(sim.id) ? 'bg-red-600 border-red-600' : 'border-zinc-600 bg-zinc-900 group-hover:border-zinc-500'}`}>
                              {accessControl.simulated.includes(sim.id) && <Check size={14} className="text-white" />}
                            </div>
                            <span className="text-xs text-zinc-300 group-hover:text-white transition-colors truncate">
                              {sim.title || sim.name || 'Sem nome definido'}
                            </span>
                          </label>
                        ))}
                        {filteredSimulated.length === 0 && (
                          <p className="text-xs text-zinc-600 italic py-4 text-center col-span-2">
                            {searchSimulated ? 'Nenhum simulado encontrado para esta busca.' : 'Nenhum simulado cadastrado.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-zinc-800 shrink-0 flex justify-end gap-4 bg-black/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
            disabled={loading}
          >
            CANCELAR
          </button>
          <button
            type="submit"
            form="live-event-form"
            disabled={loading}
            className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                SALVANDO...
              </>
            ) : (
              'SALVAR EVENTO'
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
