import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Upload, ChevronDown, ChevronUp, Search, Plus, Trash2, Copy, Check, Globe, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Product, ProductType, ProductOffer, ProductSplit } from '../../../types/product';
import { createProduct, updateProduct, uploadProductCover } from '../../../services/productService';
import { syncProductResourcesForStudents } from '../../../services/userService';
import { getPlans } from '../../../services/planService';
import { Plan } from '../../../types/plan';
import { courseService } from '../../../services/courseService';
import { OnlineCourse } from '../../../types/course';
import { getSimulatedClasses, SimulatedExam } from '../../../services/simulatedService';
import { classService } from '../../../services/classService';
import { Class } from '../../../types/class';
import { liveEventService } from '../../../services/liveEventService';
import { LiveEvent } from '../../../types/liveEvent';
import { coproducerService } from '../../../services/coproducerService';
import { Coproducer } from '../../../types/coproducer';
import { useAuth } from '../../../contexts/AuthContext';
import { Users, DollarSign } from 'lucide-react';

interface ProductFormModalProps {
  product: Product | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ProductFormModal({ product, onClose, onSave }: ProductFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  // Form State
  const [name, setName] = useState(product?.name || '');
  const [offers, setOffers] = useState<ProductOffer[]>(product?.offers || []);
  const [coproduction, setCoproduction] = useState<ProductSplit[]>(product?.coproduction || []);
  const [gatewayId, setGatewayId] = useState(product?.gatewayId || '');
  const [type, setType] = useState<ProductType>(product?.type || 'COMBO');
  const [accessDays, setAccessDays] = useState(product?.accessDays || 365);
  const [coverUrl, setCoverUrl] = useState(product?.coverUrl || '');
  const [checkoutCoverUrl, setCheckoutCoverUrl] = useState(product?.checkoutCoverUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingCheckout, setIsUploadingCheckout] = useState(false);
  const [searchTerms] = useState({ plans: '', courses: '', classes: '', simulated: '', liveEvents: '' });
  const [expanded, setExpanded] = useState({ plans: false, courses: false, classes: false, simulated: false, liveEvents: false });

  // Linked Resources State
  const [linkedPlans, setLinkedPlans] = useState<string[]>(product?.linkedResources.plans || []);
  const [linkedCourses, setLinkedCourses] = useState<string[]>(product?.linkedResources.onlineCourses || []);
  const [linkedClasses, setLinkedClasses] = useState<string[]>(product?.linkedResources.presentialClasses || []);
  const [linkedSimulated, setLinkedSimulated] = useState<string[]>(product?.linkedResources.simulated || []);
  const [linkedLiveEvents, setLinkedLiveEvents] = useState<string[]>(product?.linkedResources.liveEvents || product?.liveEventIds || []);

  // Available Resources State
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [availableCourses, setAvailableCourses] = useState<OnlineCourse[]>([]);
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [availableSimulated, setAvailableSimulated] = useState<SimulatedExam[]>([]);
  const [availableLiveEvents, setAvailableLiveEvents] = useState<LiveEvent[]>([]);
  const [availableCoproducers, setAvailableCoproducers] = useState<Coproducer[]>([]);
  const [activeTab, setActiveTab] = useState<'resources' | 'split'>('resources');

  useEffect(() => {
    const loadResources = async () => {
      try {
        const [plans, courses, classes, simulated, liveEvents, coproducers] = await Promise.all([
          getPlans(),
          courseService.getCourses(),
          classService.getClasses(),
          getSimulatedClasses(),
          liveEventService.getLiveEvents(),
          coproducerService.getAll()
        ]);
        setAvailablePlans(plans);
        setAvailableCourses(courses);
        setAvailableClasses(classes);
        setAvailableSimulated(simulated);
        setAvailableLiveEvents(liveEvents);
        setAvailableCoproducers(coproducers);
      } catch (err) {
        console.error('Failed to load resources:', err);
        setError('Erro ao carregar recursos disponíveis.');
      }
    };
    loadResources();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!name || !gatewayId || !type || !accessDays) {
      setError('Preencha todos os campos obrigatórios.');
      setLoading(false);
      return;
    }

    if (offers.length === 0) {
      setError('Adicione pelo menos uma oferta ao produto.');
      setLoading(false);
      return;
    }

    if (!offers.some(o => o.isDefault)) {
      setError('Selecione uma oferta como padrão (Default).');
      setLoading(false);
      return;
    }

    // Validação de Coprodução
    const totalPercentage = coproduction.reduce((acc, curr) => acc + curr.percentage, 0);
    if (totalPercentage > 100) {
      setError(`A soma das porcentagens (${totalPercentage}%) não pode ultrapassar 100%.`);
      setLoading(false);
      return;
    }

    const productData = {
      name,
      offers,
      coproduction,
      gatewayId,
      type,
      accessDays,
      coverUrl,
      checkoutCoverUrl,
      linkedResources: {
        plans: linkedPlans,
        onlineCourses: linkedCourses,
        presentialClasses: linkedClasses,
        simulated: linkedSimulated,
        liveEvents: linkedLiveEvents
      },
      liveEventIds: linkedLiveEvents
    };

    try {
      if (product?.id) {
        await updateProduct(product.id, productData);
        // Sincroniza os acessos dos alunos se o produto já existir e for editado
        await syncProductResourcesForStudents(product.id, productData.linkedResources);
      } else {
        await createProduct(productData);
      }
      onSave();
    } catch (err) {
      console.error('Failed to save product:', err);
      setError('Erro ao salvar produto. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const addOffer = () => {
    const newOffer: ProductOffer = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      price: 0,
      originalPrice: 0,
      isDefault: offers.length === 0,
      isActive: true,
      isAffiliationEnabled: false,
      affiliateCommission: 0,
      pixDiscount: 0,
      boletoDiscount: 0
    };
    setOffers([...offers, newOffer]);
  };

  const removeOffer = (id: string) => {
    setOffers(offers.filter(o => o.id !== id));
  };

  const updateOffer = (id: string, updates: Partial<ProductOffer>) => {
    setOffers(offers.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const setDefaultOffer = (id: string) => {
    setOffers(offers.map(o => ({ ...o, isDefault: o.id === id })));
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyOfferLink = (offerId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/checkout/${offerId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(offerId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addCoproducer = (coproducerId: string) => {
    const partner = availableCoproducers.find(c => c.id === coproducerId);
    if (!partner) return;
    
    if (coproduction.find(c => c.coproducerId === coproducerId)) {
      setError('Este coprodutor já foi adicionado.');
      return;
    }

    const newSplit: ProductSplit = {
      id: Math.random().toString(36).substr(2, 9),
      productId: product?.id || 'new',
      coproducerId: partner.id,
      coproducerName: partner.name,
      coproducerEmail: partner.email,
      percentage: 0,
      pagarmeRecipientId: partner.pagarmeRecipientId || '' // Agora automático
    };
    setCoproduction([...coproduction, newSplit]);
  };

  const removeCoproducer = (id: string) => {
    setCoproduction(coproduction.filter(c => c.id !== id));
  };

  const updateCoproducer = (id: string, updates: Partial<ProductSplit>) => {
    setCoproduction(coproduction.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const productTypes: ProductType[] = ['COMBO', 'PLANO', 'TURMA_ONLINE', 'CURSO_ISOLADO', 'SIMULADO', 'EVENTO'];

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-zinc-900 border-b border-zinc-800 shadow-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tighter">
                {product ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              {product && <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{product.name}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all"
            >
              Cancelar
            </button>
            <button
              form="product-form"
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>CARREGANDO...</>
              ) : (
                <>
                  <Save size={16} />
                  Salvar Produto
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-8">
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        <form id="product-form" onSubmit={handleSubmit} className="space-y-12">
          {/* Section: Basic Info */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-800/50 bg-zinc-900/30">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Informações Gerais</h3>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                    Nome Interno do Produto *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Combo Polícia Civil VIP"
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                    ID de Checkout (URL) *
                  </label>
                  <input
                    type="text"
                    value={gatewayId}
                    onChange={(e) => setGatewayId(e.target.value)}
                    placeholder="Ex: 12345"
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 font-mono transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                    Tipo de Produto *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as ProductType)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 appearance-none transition-colors"
                    required
                  >
                    {productTypes.map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                    Acesso (Dias) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={accessDays}
                    onChange={(e) => setAccessDays(parseInt(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                    required
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section: Offers */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-800/50 bg-zinc-900/30 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Ofertas e Precificação</h3>
                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-tight mt-1">Configure múltiplos checkouts e regras de afiliação.</p>
              </div>
              <button
                type="button"
                onClick={addOffer}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-700"
              >
                <Plus size={14} />
                Adicionar Oferta
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {offers.map((offer) => (
                <div 
                  key={offer.id} 
                  className={`p-6 bg-zinc-950 border rounded-2xl transition-all ${
                    offer.isDefault ? 'border-red-600/40 shadow-2xl shadow-red-600/5' : 'border-zinc-800'
                  }`}
                >
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-start">
                    <div className="xl:col-span-2">
                      <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">Nome da Oferta</label>
                      <input
                        type="text"
                        value={offer.name}
                        onChange={(e) => updateOffer(offer.id, { name: e.target.value })}
                        placeholder="Ex: Preço Promocional"
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition-all font-bold"
                      />
                    </div>

                    <div className="xl:col-span-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">Preço (R$)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 font-bold text-[10px]">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={offer.price}
                            onChange={(e) => updateOffer(offer.id, { price: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl pl-8 pr-2 py-3 text-sm focus:outline-none focus:border-red-500 transition-all font-mono font-bold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">De (R$)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 font-bold text-[10px]">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={offer.originalPrice || 0}
                            onChange={(e) => updateOffer(offer.id, { originalPrice: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-xl pl-8 pr-2 py-3 text-sm focus:outline-none focus:border-red-500 transition-all font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="xl:col-span-3 space-y-4">
                      <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Config. Afiliação</label>
                          <div 
                            onClick={() => updateOffer(offer.id, { isAffiliationEnabled: !offer.isAffiliationEnabled })}
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-all ${offer.isAffiliationEnabled ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                          >
                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-all ${offer.isAffiliationEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <p className="text-[8px] text-zinc-600 font-bold uppercase mb-1">Comissão (%)</p>
                            <input 
                              type="number"
                              disabled={!offer.isAffiliationEnabled}
                              value={offer.affiliateCommission || 0}
                              onChange={(e) => updateOffer(offer.id, { affiliateCommission: Number(e.target.value) })}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-emerald-500 disabled:opacity-20"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-[8px] text-zinc-600 font-bold uppercase mb-1">Valor Final</p>
                            <div className="px-2 py-1.5 bg-emerald-500/5 rounded-lg text-emerald-500 font-mono font-bold text-xs border border-emerald-500/10 truncate">
                              R$ {((offer.price * (offer.affiliateCommission || 0)) / 100).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-3 text-center">Descontos Adicionais</label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[8px] text-zinc-600 font-bold uppercase mb-1">Desconto PIX (%)</p>
                            <input 
                              type="number"
                              value={offer.pixDiscount || 0}
                              onChange={(e) => updateOffer(offer.id, { pixDiscount: Number(e.target.value) })}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] font-mono font-bold text-red-500 text-center"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <p className="text-[8px] text-zinc-600 font-bold uppercase mb-1">Desconto Boleto (%)</p>
                            <input 
                              type="number"
                              value={offer.boletoDiscount || 0}
                              onChange={(e) => updateOffer(offer.id, { boletoDiscount: Number(e.target.value) })}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] font-mono font-bold text-red-500 text-center"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="xl:col-span-4 flex items-center justify-end gap-2 xl:gap-3 pt-6 xl:pt-0 border-t xl:border-t-0 border-zinc-900">
                      <button
                        type="button"
                        onClick={() => updateOffer(offer.id, { isActive: !offer.isActive })}
                        className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-[8px] font-black uppercase transition-all min-w-[70px] ${
                          offer.isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                        }`}
                      >
                        <Globe size={16} />
                        {offer.isActive ? 'Visível' : 'Oculto'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDefaultOffer(offer.id)}
                        className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-[8px] font-black uppercase transition-all min-w-[100px] ${
                          offer.isDefault ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                        }`}
                      >
                        <Check size={16} />
                        {offer.isDefault ? 'Favorito' : 'Tornar Padrão'}
                      </button>

                      <div className="flex items-center gap-2">
                        {product?.id && (
                          <button
                            type="button"
                            onClick={() => copyOfferLink(offer.id)}
                            className={`p-3 rounded-xl transition-all ${
                              copiedId === offer.id ? 'bg-green-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}
                          >
                            {copiedId === offer.id ? <Check size={18} /> : <Copy size={18} />}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => removeOffer(offer.id)}
                          className="p-3 bg-zinc-900 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 border border-zinc-800 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {offers.length === 0 && (
                <div className="p-12 text-center bg-zinc-950/30 border border-zinc-800 border-dashed rounded-3xl">
                  <DollarSign className="mx-auto text-zinc-800 mb-4" size={40} />
                  <h4 className="text-zinc-500 font-black uppercase tracking-widest">Nenhuma oferta definida</h4>
                  <p className="text-[10px] text-zinc-700 uppercase font-bold mt-1">Crie ofertas para gerar checkouts e definir a precificação do produto.</p>
                </div>
              )}
            </div>
          </section>

          {/* Section: Advanced Content */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-800/50 bg-zinc-900/30">
              <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab('resources')}
                  className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'resources' 
                      ? 'bg-zinc-800 text-white shadow-2xl' 
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <Users size={14} />
                  Conteúdo Entregue
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('split')}
                  className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'split' 
                      ? 'bg-zinc-800 text-white shadow-2xl' 
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <DollarSign size={14} />
                  Coprodução / Split
                </button>
              </div>
            </div>

            <div className="p-8">
              {activeTab === 'resources' ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
                  <div className="lg:col-span-1 space-y-8">
                    <div>
                      <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-4">Capa do Produto (Vertical)</label>
                      <div className="relative group">
                        {coverUrl ? (
                          <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
                            <img src={coverUrl} alt="Capa" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          </div>
                        ) : (
                          <div className="aspect-[3/4] bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-center border-dashed">
                            <Upload className="text-zinc-800" size={40} />
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all rounded-2xl backdrop-blur-sm">
                          <div className="text-white flex flex-col items-center gap-2">
                             <Upload size={24} />
                             <span className="text-[10px] font-black uppercase">{coverUrl ? 'Trocar' : 'Enviar'}</span>
                          </div>
                          <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (!currentUser) {
                                toast.error('Você precisa estar logado para fazer upload.');
                                return;
                              }
                              setIsUploading(true);
                              try {
                                 const url = await uploadProductCover(file);
                                 setCoverUrl(url);
                                 toast.success('Capa carregada com sucesso!');
                              } catch (err: any) { 
                                 console.error("Upload Error:", err);
                                 toast.error('Erro no upload: ' + (err.message || 'Verifique as permissões do Storage')); 
                              }
                              setIsUploading(false);
                            }
                          }} />
                        </label>
                      </div>
                      <p className="text-[9px] text-zinc-700 italic mt-4 text-center">Formato recomendado: 474x1000px</p>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-4">Capa do Checkout (16:9)</label>
                      <div className="relative group">
                        {checkoutCoverUrl ? (
                          <div className="aspect-video rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
                            <img src={checkoutCoverUrl} alt="Capa Checkout" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          </div>
                        ) : (
                          <div className="aspect-video bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-center border-dashed">
                            <Upload className="text-zinc-800" size={40} />
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all rounded-2xl backdrop-blur-sm">
                          <div className="text-white flex flex-col items-center gap-2">
                             <Upload size={24} />
                             <span className="text-[10px] font-black uppercase">{checkoutCoverUrl ? 'Trocar' : 'Enviar'}</span>
                          </div>
                          <input type="file" accept="image/*" className="hidden" disabled={isUploadingCheckout} onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (!currentUser) {
                                toast.error('Você precisa estar logado para fazer upload.');
                                return;
                              }
                              setIsUploadingCheckout(true);
                              try {
                                 const url = await uploadProductCover(file);
                                 setCheckoutCoverUrl(url);
                                 toast.success('Capa do checkout carregada!');
                              } catch (err: any) { 
                                 console.error("Upload Error (Checkout):", err);
                                 toast.error('Erro no upload: ' + (err.message || 'Verifique as permissões do Storage')); 
                              }
                              setIsUploadingCheckout(false);
                            }
                          }} />
                        </label>
                      </div>
                      <p className="text-[9px] text-zinc-700 italic mt-4 text-center">Formato recomendado: 1920x1080px (16:9)</p>
                    </div>
                  </div>

                  <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
                    {/* Plans */}
                    <div className="border border-zinc-800 rounded-2xl bg-zinc-950/50 overflow-hidden h-fit">
                      <button type="button" onClick={() => setExpanded(prev => ({ ...prev, plans: !prev.plans }))} className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900/50 hover:bg-zinc-800 transition text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                        <span>Planos de Estudo ({linkedPlans.length})</span>
                        {expanded.plans ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {expanded.plans && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <select
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-red-500 outline-none transition-all font-bold"
                            onChange={(e) => {
                              const id = e.target.value;
                              if (id && !linkedPlans.includes(id)) setLinkedPlans([...linkedPlans, id]);
                              e.target.value = "";
                            }}
                            value=""
                          >
                            <option value="">Adicionar plano...</option>
                            {availablePlans.filter(p => !linkedPlans.includes(p.id)).map(plan => (
                              <option key={plan.id} value={plan.id}>{plan.title || plan.name}</option>
                            ))}
                          </select>
                          <div className="space-y-2">
                            {linkedPlans.map((id) => (
                              <div key={id} className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-900 group">
                                <span className="text-xs text-zinc-400 font-bold">{availablePlans.find(p => p.id === id)?.title || 'Plano'}</span>
                                <button type="button" onClick={() => setLinkedPlans(linkedPlans.filter(p => p !== id))} className="text-zinc-600 hover:text-red-500 transition-colors">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Courses */}
                    <div className="border border-zinc-800 rounded-2xl bg-zinc-950/50 overflow-hidden h-fit">
                      <button type="button" onClick={() => setExpanded(prev => ({ ...prev, courses: !prev.courses }))} className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900/50 hover:bg-zinc-800 transition text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                        <span>Cursos Online ({linkedCourses.length})</span>
                        {expanded.courses ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {expanded.courses && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <select
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-red-500 outline-none transition-all font-bold"
                            onChange={(e) => {
                              const id = e.target.value;
                              if (id && !linkedCourses.includes(id)) setLinkedCourses([...linkedCourses, id]);
                              e.target.value = "";
                            }}
                            value=""
                          >
                            <option value="">Adicionar curso...</option>
                            {availableCourses.filter(p => !linkedCourses.includes(p.id)).map(c => (
                              <option key={c.id} value={c.id}>{c.title || c.name}</option>
                            ))}
                          </select>
                          <div className="space-y-2">
                            {linkedCourses.map((id) => (
                              <div key={id} className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-900 group">
                                <span className="text-xs text-zinc-400 font-bold">{availableCourses.find(p => p.id === id)?.title || 'Curso'}</span>
                                <button type="button" onClick={() => setLinkedCourses(linkedCourses.filter(p => p !== id))} className="text-zinc-600 hover:text-red-500 transition-colors">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Turmas */}
                    <div className="border border-zinc-800 rounded-2xl bg-zinc-950/50 overflow-hidden h-fit">
                      <button type="button" onClick={() => setExpanded(prev => ({ ...prev, classes: !prev.classes }))} className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900/50 hover:bg-zinc-800 transition text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                        <span>Turmas Presenciais ({linkedClasses.length})</span>
                        {expanded.classes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {expanded.classes && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <select
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-red-500 outline-none transition-all font-bold"
                            onChange={(e) => {
                              const id = e.target.value;
                              if (id && !linkedClasses.includes(id)) setLinkedClasses([...linkedClasses, id]);
                              e.target.value = "";
                            }}
                            value=""
                          >
                            <option value="">Adicionar turma...</option>
                            {availableClasses.filter(p => !linkedClasses.includes(p.id)).map(c => (
                              <option key={c.id} value={c.id}>{c.title || c.name}</option>
                            ))}
                          </select>
                          <div className="space-y-2">
                            {linkedClasses.map((id) => (
                              <div key={id} className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-900 group">
                                <span className="text-xs text-zinc-400 font-bold">{availableClasses.find(p => p.id === id)?.title || 'Turma'}</span>
                                <button type="button" onClick={() => setLinkedClasses(linkedClasses.filter(p => p !== id))} className="text-zinc-600 hover:text-red-500 transition-colors">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Simulados */}
                    <div className="border border-zinc-800 rounded-2xl bg-zinc-950/50 overflow-hidden h-fit">
                      <button type="button" onClick={() => setExpanded(prev => ({ ...prev, simulated: !prev.simulated }))} className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900/50 hover:bg-zinc-800 transition text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                        <span>Simulados ({linkedSimulated.length})</span>
                        {expanded.simulated ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {expanded.simulated && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <select
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-red-500 outline-none transition-all font-bold"
                            onChange={(e) => {
                              const id = e.target.value;
                              if (id && !linkedSimulated.includes(id)) setLinkedSimulated([...linkedSimulated, id]);
                              e.target.value = "";
                            }}
                            value=""
                          >
                            <option value="">Adicionar simulado...</option>
                            {availableSimulated.filter(p => !linkedSimulated.includes(p.id)).map(c => (
                              <option key={c.id} value={c.id}>{c.title || c.name}</option>
                            ))}
                          </select>
                          <div className="space-y-2">
                            {linkedSimulated.map((id) => (
                              <div key={id} className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-900 group">
                                <span className="text-xs text-zinc-400 font-bold">{availableSimulated.find(p => p.id === id)?.title || 'Simulado'}</span>
                                <button type="button" onClick={() => setLinkedSimulated(linkedSimulated.filter(p => p !== id))} className="text-zinc-600 hover:text-red-500 transition-colors">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-12">
                  <div className="flex items-center justify-between max-w-4xl">
                    <div className="max-w-xl">
                       <h4 className="text-white font-black uppercase tracking-widest mb-2">Divisão de Receitas (Split)</h4>
                       <p className="text-[10px] text-zinc-500 uppercase font-black leading-relaxed">
                         Adicione parceiros de negócio para que o split ocorra automaticamente no momento da venda. O valor é transferido para a conta da Pagar.me do parceiro.
                       </p>
                    </div>
                     <div className="w-64">
                       <select
                         className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:border-red-500 outline-none appearance-none transition-all"
                         onChange={(e) => {
                           if (e.target.value) addCoproducer(e.target.value);
                           e.target.value = "";
                         }}
                         value=""
                       >
                         <option value="">+ Add Parceiro</option>
                         {availableCoproducers.map(c => (
                           <option key={c.id} value={c.id}>{c.name}</option>
                         ))}
                       </select>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {coproduction.map((p) => (
                      <div key={p.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 relative group overflow-hidden shadow-2xl">
                         <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-30" />
                         <div className="flex items-center justify-between mb-6">
                            <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 text-emerald-500">
                               <Users size={20} />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCoproducer(p.id)}
                              className="p-2 text-zinc-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                         
                         <h5 className="text-sm font-black text-white uppercase tracking-widest mb-1">{p.coproducerName}</h5>
                         <p className="text-[10px] text-zinc-600 font-medium mb-6 uppercase truncate">{p.coproducerEmail}</p>

                         <div className="space-y-4">
                            <div>
                               <div className="flex justify-between items-center mb-2">
                                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Porcentagem de Split</label>
                                  <span className="text-[10px] font-black text-emerald-500">{p.percentage}%</span>
                               </div>
                               <input 
                                 type="range"
                                 min="0"
                                 max="100"
                                 step="1"
                                 value={p.percentage}
                                 onChange={(e) => updateCoproducer(p.id, { percentage: Number(e.target.value) })}
                                 className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                               />
                            </div>
                            
                            <div className="pt-4 border-t border-zinc-900">
                               <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-1">ID Pagar.me (Recipient)</p>
                               <code className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-900 px-2 py-1 rounded block border border-zinc-900">
                                 {p.pagarmeRecipientId || 'Não configurado'}
                               </code>
                            </div>
                         </div>
                      </div>
                    ))}

                    {coproduction.length === 0 && (
                      <div className="col-span-1 border-2 border-zinc-900 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center opacity-40">
                         <p className="text-xs font-black text-zinc-600 uppercase tracking-[0.2em] text-center">Nenhum parceiro de split configurado para este produto.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
