import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Calendar,
  Filter,
  Check,
  ChevronDown,
  ArrowUpRight,
  X,
  CreditCard
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getProducts } from '../../services/productService';
import { toPlainObject } from '../../services/firestoreUtils';
import { TictoProduct } from '../../types/product';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SalesReport {
  id: string;
  orderId: string;
  courseId: string;
  courseName: string;
  grossValue: number;
  gatewayFee: number;
  affiliatePart: number;
  coproductionPart: number;
  netCompanyValue: number;
  customerData?: {
    name: string;
    email: string;
    phone: string;
  };
  createdAt: string;
}

const AdminDashboard: React.FC = () => {
  const [reports, setReports] = useState<SalesReport[]>([]);
  const [products, setProducts] = useState<TictoProduct[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsData, reportsSnapshot] = await Promise.all([
          getProducts(),
          getDocs(query(collection(db, 'admin_sales_report'), orderBy('createdAt', 'desc')))
        ]);

        setProducts(productsData);
        setReports(reportsSnapshot.docs.map(doc => toPlainObject({
          id: doc.id,
          ...doc.data()
        }) as SalesReport));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtered reports based on selection
  const filteredReports = useMemo(() => {
    if (selectedProductIds.length === 0) return reports;
    return reports.filter(r => selectedProductIds.includes(r.courseId));
  }, [reports, selectedProductIds]);

  // Statistics calculations
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = subDays(todayStart, 7);
    const monthStart = subDays(todayStart, 30);

    const calculateTotal = (items: SalesReport[]) => items.reduce((acc, curr) => acc + (curr.netCompanyValue || 0), 0);

    const total = calculateTotal(filteredReports);
    
    const today = calculateTotal(filteredReports.filter(r => {
      const date = parseISO(r.createdAt);
      return date >= todayStart;
    }));

    const week = calculateTotal(filteredReports.filter(r => {
      const date = parseISO(r.createdAt);
      return date >= weekStart;
    }));

    const month = calculateTotal(filteredReports.filter(r => {
      const date = parseISO(r.createdAt);
      return date >= monthStart;
    }));

    return { total, today, week, month };
  }, [filteredReports]);

  // Chart data Preparation
  const chartData = useMemo(() => {
    const last15Days = Array.from({ length: 15 }, (_, i) => {
      const day = subDays(new Date(), i);
      return format(day, 'yyyy-MM-dd');
    }).reverse();

    return last15Days.map(dayStr => {
      const dayReports = filteredReports.filter(r => r.createdAt && r.createdAt.startsWith(dayStr));
      const value = dayReports.reduce((acc, curr) => acc + (curr.netCompanyValue || 0), 0);
      return {
        date: format(parseISO(dayStr), 'dd/MM'),
        value: value / 100 // Convert cents to real
      };
    });
  }, [filteredReports]);

  // Product Ranking
  const productRanking = useMemo(() => {
    const rankingMap = new Map<string, { name: string; net: number; count: number }>();

    filteredReports.forEach(r => {
      const current = rankingMap.get(r.courseId) || { name: r.courseName, net: 0, count: 0 };
      rankingMap.set(r.courseId, {
        name: r.courseName,
        net: current.net + (r.netCompanyValue || 0),
        count: current.count + 1
      });
    });

    return Array.from(rankingMap.values())
      .sort((a, b) => b.net - a.net)
      .slice(0, 5);
  }, [filteredReports]);

  const toggleProductFilter = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 animate-pulse">Carregando inteligência financeira...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <div className="bg-emerald-500 p-2.5 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <BarChart3 className="w-8 h-8 text-black" />
            </div>
            DASHBOARD EMPRESA
          </h1>
          <p className="text-gray-400 mt-2 font-medium">Análise de lucratividade real da Insanus Concursos</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-brand-black/40 border border-white/5 p-5 rounded-[2rem] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-xl">
              <Filter className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Filtragem Inteligente</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Selecione produtos para análise específica</p>
            </div>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="w-full sm:w-auto flex items-center justify-between gap-4 bg-brand-black border border-white/10 hover:border-emerald-500/50 px-6 py-3 rounded-xl transition-all group shadow-xl"
            >
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4 text-gray-500 group-hover:text-emerald-500 transition-colors" />
                <span className="text-xs font-bold text-gray-300">Escolher Produtos</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 bg-brand-black border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden"
                  >
                    <div className="p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                      <div className="px-3 py-2 mb-2 border-b border-white/5 flex justify-between items-center text-[10px] font-black text-gray-500 uppercase">
                        <span>Listagem de Produtos</span>
                        <span>{products.length} itens</span>
                      </div>
                      <div className="space-y-1">
                        {products.map(product => (
                          <button
                            key={product.id}
                            onClick={() => toggleProductFilter(product.id!)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group text-left ${
                              selectedProductIds.includes(product.id!) 
                                ? 'bg-emerald-500/10 border border-emerald-500/20' 
                                : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <span className={`text-sm truncate pr-4 ${selectedProductIds.includes(product.id!) ? 'text-emerald-500 font-bold' : 'text-gray-400 font-medium'}`}>
                              {product?.name || 'Sem Nome'}
                            </span>
                            {selectedProductIds.includes(product.id!) && (
                              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {selectedProductIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
            {selectedProductIds.map(id => {
              const product = products.find(p => p.id === id);
              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={id}
                  className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/20 px-3 py-1.5 rounded-xl group hover:border-emerald-400/40 transition-colors"
                >
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">{product?.name || 'Produto'}</span>
                  <button 
                    onClick={() => toggleProductFilter(id)}
                    className="hover:bg-emerald-500/20 p-0.5 rounded-lg transition-colors"
                  >
                    <X className="w-3 h-3 text-emerald-400" />
                  </button>
                </motion.div>
              );
            })}
            <button 
              onClick={() => setSelectedProductIds([])}
              className="text-[10px] font-black text-red-500/60 hover:text-red-500 uppercase tracking-[0.2em] px-4 py-1.5 transition-all hover:bg-red-500/5 rounded-xl ml-auto"
            >
              Limpar Todos os Filtros
            </button>
          </div>
        ) : (
          <div className="pt-4 border-t border-white/5 flex items-center gap-4">
             <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_#10b981]" />
               <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">Visão Geral: Todos os produtos consolidados</span>
             </div>
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Lucro Líquido Total', value: stats.total, icon: DollarSign, color: 'emerald' },
          { label: 'Lucro Hoje', value: stats.today, icon: Calendar, color: 'blue' },
          { label: 'Últimos 7 dias', value: stats.week, icon: TrendingUp, color: 'purple' },
          { label: 'Últimos 30 dias', value: stats.month, icon: ArrowUpRight, color: 'amber' },
        ].map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-brand-black/40 border border-white/5 p-6 rounded-3xl relative overflow-hidden group hover:border-emerald-500/30 transition-all"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 bg-${item.color}-500/5 blur-3xl rounded-full group-hover:bg-${item.color}-500/10 transition-all`} />
            
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-${item.color}-500/10`}>
                <item.icon className={`w-6 h-6 text-${item.color}-500`} />
              </div>
            </div>
            
            <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">{item.label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-white font-mono">{formatCurrency(item.value)}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Evolution Chart */}
        <div className="lg:col-span-2 bg-brand-black/40 border border-white/5 rounded-[2.5rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Evolução da Lucratividade
            </h2>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Últimos 15 dias</span>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 'bold' }} 
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#ffffff08' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-brand-black/95 border border-white/10 p-4 rounded-2xl shadow-2xl">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{payload[0].payload.date}</p>
                          <p className="text-lg font-black text-emerald-500">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[8, 8, 0, 0]}
                  barSize={32}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.value > 0 ? '#10b981' : '#374151'} 
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Ranking */}
        <div className="bg-brand-black/40 border border-white/5 rounded-[2.5rem] p-8">
          <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
            <Package className="w-5 h-5 text-emerald-500" />
            Ranking de Lucro
          </h2>

          <div className="space-y-6">
            {productRanking.length > 0 ? (
              productRanking.map((item, idx) => (
                <div key={idx} className="group cursor-default">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-300 truncate max-w-[180px] group-hover:text-emerald-500 transition-colors">
                      {item?.name || 'N/A'}
                    </span>
                    <span className="text-sm font-black text-white font-mono">{formatCurrency(item.net)}</span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.net / stats.total) * 100}%` }}
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">
                      {item.count} VENDAS
                    </p>
                    <p className="text-[10px] font-bold text-emerald-500/50 uppercase tracking-tighter">
                      {((item.net / stats.total) * 100).toFixed(1)}% DO LUCRO
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center p-8 border-2 border-dashed border-white/5 rounded-3xl">
                <Package className="w-12 h-12 text-gray-700 mb-4" />
                <p className="text-gray-500 font-medium">Nenhuma venda encontrada para o período selecionado.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recents Table (Bonus for detail) */}
      <div className="bg-brand-black/40 border border-white/5 rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            Últimas Transações Detalhadas
          </h2>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                <th className="px-8 py-4">Produto</th>
                <th className="px-8 py-4">Cliente</th>
                <th className="px-8 py-4">Bruto</th>
                <th className="px-8 py-4 text-red-500/70">Taxas/Comissões</th>
                <th className="px-8 py-4 text-emerald-500">Líquido Insanus</th>
                <th className="px-8 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredReports.slice(0, 5).map((r) => {
                const totalDeductions = r.gatewayFee + r.affiliatePart + r.coproductionPart;
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-white group-hover:text-emerald-500 transition-colors">{r.courseName}</p>
                      <p className="text-[10px] font-mono text-gray-600">ID: {r.orderId}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-medium text-gray-300">{r.customerData?.name || (r as any).customer?.name || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{r.customerData?.email || (r as any).customer?.email || 'N/A'}</p>
                    </td>
                    <td className="px-8 py-5 font-mono text-sm text-gray-400">
                      {formatCurrency(r.grossValue)}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-red-500/60 uppercase">-{formatCurrency(totalDeductions)}</span>
                        <span className="text-[9px] text-gray-600">({((totalDeductions / r.grossValue) * 100).toFixed(1)}%)</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="inline-flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full">
                        <DollarSign className="w-3 h-3 text-emerald-500" />
                        <span className="text-sm font-black text-emerald-500 font-mono">{formatCurrency(r.netCompanyValue)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-gray-500">
                      {format(parseISO(r.createdAt), 'dd MMMM, HH:mm', { locale: ptBR })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredReports.length === 0 && (
            <div className="p-12 text-center text-gray-600 font-medium italic">
              Nenhuma transação registrada ainda.
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.5); }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
