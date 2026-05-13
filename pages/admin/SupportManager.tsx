import React, { useState, useEffect } from 'react';
import { 
  Headset, LayoutGrid, LayoutList, ChevronRight, 
  MessageCircle, Clock, CheckCircle2, AlertCircle,
  Megaphone, Heart, AlertTriangle, UserPlus, Star
} from 'lucide-react';
import { motion } from 'motion/react';
import { supportService } from '../../services/supportService';
import { feedbackService } from '../../services/feedbackService';
import { SupportTicket, ProductType } from '../../types/support';
import { Feedback, FeedbackCategory } from '../../types/feedback';
import { SupportChatConsole } from './SupportChatConsole';
import { FeedbackPanel } from '../../components/admin/support/FeedbackPanel';
import Loading from '../../components/ui/Loading';

const CATEGORIES = [
  { id: 'plano', label: 'Planos de Estudo', icon: LayoutGrid, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'curso_online', label: 'Cursos Online', icon: LayoutList, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'turma_presencial', label: 'Turmas Presenciais', icon: Clock, color: 'text-green-500', bg: 'bg-green-500/10' },
  { id: 'simulado', label: 'Simulados', icon: CheckCircle2, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'evento_ao_vivo', label: 'Eventos Ao Vivo', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
];

interface ProductStats {
  id: string;
  name: string;
  totalCount: number;
  openCount?: number;
}

export const SupportManager: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<'tickets' | 'feedbacks'>('tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'product_list' | 'detail'>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<ProductType | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductStats | null>(null);

  useEffect(() => {
    setLoading(true);
    
    // Subscribe to tickets
    const unsubscribeTickets = supportService.subscribeToGlobalTickets((data) => {
      setTickets(data);
      // Only set loading to false if we weren't already waiting for something else
      // Or just set it false here once we have the first batch
    });

    // Fetch all feedbacks in parallel
    const loadData = async () => {
      try {
        const allFeedbacks = await feedbackService.getAllFeedbacks();
        setFeedbacks(allFeedbacks);
      } catch (error) {
        console.error('Error loading feedbacks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => unsubscribeTickets();
  }, []);

  const getUnreadCount = (type: ProductType) => {
    return tickets.filter(t => t.productType === type && t.status === 'open').length;
  };

  const getFeedbackCount = (type: string) => {
    return feedbacks.filter(f => f.productType === type).length;
  };

  // Agrupar produtos por categoria
  const getProductsInCategory = (type: ProductType): ProductStats[] => {
    if (activeMainTab === 'tickets') {
      const products: Record<string, ProductStats> = {};
      tickets.filter(t => t.productType === type).forEach(t => {
        if (!products[t.productId]) {
          products[t.productId] = { id: t.productId, name: t.productName, openCount: 0, totalCount: 0 };
        }
        if (t.status === 'open' && products[t.productId].openCount !== undefined) {
          products[t.productId].openCount!++;
        }
        products[t.productId].totalCount++;
      });
      return Object.values(products);
    } else {
      const products: Record<string, ProductStats> = {};
      feedbacks.filter(f => f.productType === type).forEach(f => {
        if (!products[f.productId]) {
          products[f.productId] = { id: f.productId, name: f.productName, totalCount: 0 };
        }
        products[f.productId].totalCount++;
      });
      return Object.values(products);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-black p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/20">
              <Headset className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
              {activeMainTab === 'tickets' ? 'Gestão de Suporte' : 'Ouvidoria & Feedback'}
            </h1>
          </div>
          <p className="text-zinc-500 text-sm">Central de {activeMainTab === 'tickets' ? 'atendimento multicanal' : 'ouvidoria e escuta ativa'} - Equipe Insanus</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Main Tabs */}
          <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button 
              onClick={() => {
                setActiveMainTab('tickets');
                setView('dashboard');
              }}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeMainTab === 'tickets' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Atendimento (Tickets)
            </button>
            <button 
              onClick={() => {
                setActiveMainTab('feedbacks');
                setView('dashboard');
              }}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeMainTab === 'feedbacks' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Ouvidoria (Feedbacks)
            </button>
          </div>

          {view !== 'dashboard' && (
            <button 
              onClick={() => {
                if (view === 'detail') setView('product_list');
                else setView('dashboard');
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg transition-all text-xs uppercase"
            >
              Voltar
            </button>
          )}
        </div>
      </div>

      {/* View: Dashboard */}
      {view === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {CATEGORIES.map((cat) => {
            const openCount = getUnreadCount(cat.id as ProductType);
            const fbCount = getFeedbackCount(cat.id);
            const accentColor = activeMainTab === 'tickets' ? 'orange' : 'blue';

            return (
              <motion.button
                key={cat.id}
                whileHover={{ y: -5 }}
                onClick={() => {
                  setSelectedCategory(cat.id as ProductType);
                  setView('product_list');
                }}
                className={`bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-left group transition-all hover:border-${accentColor}-500/30 relative`}
              >
                {activeMainTab === 'tickets' && openCount > 0 && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-[10px] font-black text-white animate-bounce shadow-lg shadow-orange-900/40">
                    {openCount}
                  </div>
                )}
                {activeMainTab === 'feedbacks' && fbCount > 0 && (
                  <div className="absolute top-4 right-4 px-2 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-blue-900/40">
                    {fbCount} REGISTROS
                  </div>
                )}
                <div className={`w-12 h-12 ${cat.bg} rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                  <cat.icon className={`${cat.color}`} size={24} />
                </div>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-1">{cat.label}</h3>
                <p className="text-zinc-500 text-xs">
                  {activeMainTab === 'tickets' 
                    ? `${tickets.filter(t => t.productType === cat.id).length} chamados totais`
                    : `${fbCount} feedbacks recebidos`
                  }
                </p>
                <div className={`mt-4 flex items-center text-zinc-400 text-[10px] font-bold uppercase group-hover:text-${accentColor}-500 transition-colors`}>
                  {activeMainTab === 'tickets' ? 'Ver atendimentos' : 'Ver feedbacks'} <ChevronRight size={14} />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* View: Product List */}
      {view === 'product_list' && selectedCategory && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-zinc-500 text-sm font-bold uppercase">Categoria:</span>
            <span className={`${activeMainTab === 'tickets' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'} px-3 py-1 rounded-full text-xs font-black uppercase border`}>
              {CATEGORIES.find(c => c.id === selectedCategory)?.label}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getProductsInCategory(selectedCategory).map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  setSelectedProduct(product);
                  setView('detail');
                }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-left hover:border-zinc-700 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className={`text-white font-bold text-lg group-hover:text-${activeMainTab === 'tickets' ? 'orange' : 'blue'}-500 transition-colors`}>{product.name}</h3>
                  {activeMainTab === 'tickets' && product.openCount > 0 && (
                    <span className="bg-orange-600 text-white text-[10px] px-2 py-1 rounded-md font-black">
                      {product.openCount} NOVOS
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-zinc-500 text-xs font-medium">
                  <span className="flex items-center gap-1">
                    {activeMainTab === 'tickets' ? <MessageCircle size={14} /> : <Megaphone size={14} />} 
                    {product.totalCount} {activeMainTab === 'tickets' ? 'chamados' : 'feedbacks'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {getProductsInCategory(selectedCategory).length === 0 && (
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
              Nenhum registro encontrado para esta categoria.
            </div>
          )}
        </div>
      )}

      {/* View: Details */}
      {view === 'detail' && selectedProduct && selectedCategory && (
        activeMainTab === 'tickets' ? (
          <SupportChatConsole 
            productType={selectedCategory}
            productId={selectedProduct.id}
            productName={selectedProduct.name}
          />
        ) : (
          <FeedbackPanel 
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            productType={selectedCategory}
          />
        )
      )}
    </div>
  );
};
