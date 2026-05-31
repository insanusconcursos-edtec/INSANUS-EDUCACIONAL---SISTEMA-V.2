import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  CreditCard,
  Wallet,
  ArrowRightCircle,
  Clock,
  RefreshCw,
  Lock,
  Search,
  ChevronLeft,
  ChevronRight
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
import { collection, query, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getProducts } from '../../services/productService';
import { toPlainObject } from '../../services/firestoreUtils';
import { TictoProduct } from '../../types/product';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MASTER_RECIPIENT_ID = 're_cmouicmz204gz0l9tyr4jkmut';

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
  const [balance, setBalance] = useState<{ available: number; waiting_funds: number; transferred?: number; recipient_name?: string } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Filtros avançados para as transações detalhadas
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | '7days' | '30days' | '90days' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pageSize, setPageSize] = useState<number | 'all'>(15);
  const [currentPage, setCurrentPage] = useState(1);

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

  const fetchBalance = async () => {
    setLoadingBalance(true);
    try {
      const response = await fetch(`/api/payments/pagarme/balance?recipientId=${MASTER_RECIPIENT_ID}`);
      if (!response.ok) throw new Error('Falha ao buscar saldo');
      const data = await response.json();
      
      if (data.success && data.balance) {
        setBalance(data.balance);
      }
    } catch (err) {
      console.error('Error fetching master balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchBalance();

    // Listen to changes in reports for real-time updates
    const unsubscribe = onSnapshot(query(collection(db, 'admin_sales_report'), orderBy('createdAt', 'desc')), (snap) => {
      setReports(snap.docs.map(doc => toPlainObject({
        id: doc.id,
        ...doc.data()
      }) as SalesReport));
    });

    return () => unsubscribe();
  }, []);

  const calculateDeductions = useCallback((report: SalesReport) => {
    const safeGatewayFee = Number(report.gatewayFee) || 0;
    let safeCoproductionPart = 0;
    let safeAffiliatePart = 0;

    const baseCalculo = report.grossValue - safeGatewayFee;

    const product = products.find(p => p.id === report.courseId);
    if (product) {
       // Cálculo de afiliado (sempre sobre baseCalculo)
       if (Number(report.affiliatePart) > 0) {
           const affiliateP = Math.round((Number(report.affiliatePart) / report.grossValue) * 100);
           if (affiliateP > 0 && affiliateP <= 100) {
              safeAffiliatePart = Math.floor(baseCalculo * (affiliateP / 100));
           } else {
              safeAffiliatePart = Number(report.affiliatePart);
           }
       }

       // Cálculo de coprodução em cascata (sobre baseCalculo - affiliate)
       const coproducers = (product as any).coproduction || (product as any).coproducers || [];
       const totalCoproPercentage = coproducers.reduce((acc: number, copro: any) => acc + (Number(copro.percentage) || 0), 0);
       if (totalCoproPercentage > 0) {
           const remainderForCopro = baseCalculo - safeAffiliatePart;
           safeCoproductionPart = Math.floor(remainderForCopro * (totalCoproPercentage / 100));
       }
    }

    return {
       gatewayFee: safeGatewayFee,
       coproductionPart: safeCoproductionPart,
       affiliatePart: safeAffiliatePart,
       totalDeductions: safeGatewayFee + safeCoproductionPart + safeAffiliatePart,
       netCompanyValue: baseCalculo - safeCoproductionPart - safeAffiliatePart
    };
  }, [products]);

  // Filtered reports based on selection
  const filteredReports = useMemo(() => {
    if (selectedProductIds.length === 0) return reports;
    return reports.filter(r => selectedProductIds.includes(r.courseId));
  }, [reports, selectedProductIds]);

  // Filtrado por produtos selecionados e período de data selecionado
  const filteredReportsByDate = useMemo(() => {
    let result = reports;
    if (selectedProductIds.length > 0) {
      result = result.filter(r => selectedProductIds.includes(r.courseId));
    }

    const now = new Date();
    const todayStart = startOfDay(now);

    if (dateFilterType === 'today') {
      result = result.filter(r => parseISO(r.createdAt) >= todayStart);
    } else if (dateFilterType === '7days') {
      const limit = subDays(todayStart, 7);
      result = result.filter(r => parseISO(r.createdAt) >= limit);
    } else if (dateFilterType === '30days') {
      const limit = subDays(todayStart, 30);
      result = result.filter(r => parseISO(r.createdAt) >= limit);
    } else if (dateFilterType === '90days') {
      const limit = subDays(todayStart, 90);
      result = result.filter(r => parseISO(r.createdAt) >= limit);
    } else if (dateFilterType === 'custom') {
      if (startDate) {
        const start = startOfDay(parseISO(startDate));
        result = result.filter(r => parseISO(r.createdAt) >= start);
      }
      if (endDate) {
        // Garante que pega até o final do dia selecionado
        const end = startOfDay(subDays(parseISO(endDate), -1));
        result = result.filter(r => parseISO(r.createdAt) < end);
      }
    }
    return result;
  }, [reports, selectedProductIds, dateFilterType, startDate, endDate]);

  // Filtrado pelo termo de busca (Nome, e-mail, CPF, orderId ou nome do produto)
  const searchFilteredReports = useMemo(() => {
    if (!searchTerm.trim()) return filteredReportsByDate;

    const cleanSearch = searchTerm.toLowerCase().trim();
    const cleanSearchNumbers = cleanSearch.replace(/\D/g, '');

    return filteredReportsByDate.filter(r => {
      const customerName = (r.customerData?.name || (r as any).customer?.name || '').toLowerCase();
      const customerEmail = (r.customerData?.email || (r as any).customer?.email || '').toLowerCase();
      const customerPhone = (r.customerData?.phone || (r as any).customer?.phone || '').replace(/\D/g, '');
      const customerCpf = (r.customerData?.cpf || (r as any).customer?.document || (r as any).customer?.document_number || '').replace(/\D/g, '');
      const rOrderId = (r.orderId || '').toLowerCase();
      const rProductName = (r.courseName || '').toLowerCase();

      return (
        customerName.includes(cleanSearch) ||
        customerEmail.includes(cleanSearch) ||
        rOrderId.includes(cleanSearch) ||
        rProductName.includes(cleanSearch) ||
        (cleanSearchNumbers && (customerPhone.includes(cleanSearchNumbers) || customerCpf.includes(cleanSearchNumbers)))
      );
    });
  }, [filteredReportsByDate, searchTerm]);

  // Totais retornados para o filtro de busca atual
  const queryTotals = useMemo(() => {
    return searchFilteredReports.reduce((acc, curr) => {
      const { netCompanyValue } = calculateDeductions(curr);
      return {
        gross: acc.gross + (curr.grossValue || 0),
        net: acc.net + netCompanyValue,
        count: acc.count + 1
      };
    }, { gross: 0, net: 0, count: 0 });
  }, [searchFilteredReports, calculateDeductions]);

  // Paginação
  const paginatedReports = useMemo(() => {
    if (pageSize === 'all') return searchFilteredReports;
    const startIndex = (currentPage - 1) * pageSize;
    return searchFilteredReports.slice(startIndex, startIndex + pageSize);
  }, [searchFilteredReports, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.ceil(searchFilteredReports.length / pageSize);
  }, [searchFilteredReports, pageSize]);

  // Resetar página ao mudar filtros ou busca
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedProductIds, dateFilterType, startDate, endDate, pageSize]);

  // Statistics calculations
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = subDays(todayStart, 7);
    const monthStart = subDays(todayStart, 30);

    const calculateTotal = (items: SalesReport[]) => items.reduce((acc, curr) => {
        const { netCompanyValue } = calculateDeductions(curr);
        return acc + netCompanyValue;
    }, 0);

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
      const value = dayReports.reduce((acc, curr) => {
        const { netCompanyValue } = calculateDeductions(curr);
        return acc + netCompanyValue;
      }, 0);
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
      
      const { netCompanyValue } = calculateDeductions(r);
      const safeNet = netCompanyValue;

      rankingMap.set(r.courseId, {
        name: r.courseName,
        net: current.net + safeNet,
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
        
        <button 
          onClick={() => { fetchData(); fetchBalance(); }}
          className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-gray-300 font-bold uppercase text-[10px] tracking-widest transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </button>
      </div>

      {/* Wallet / Master Balance Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-black border-2 border-emerald-500/30 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)] group"
        >
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_15px_#10b981] opacity-50"></div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <Wallet className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">
                  {balance?.recipient_name ? `CARTEIRA: ${balance.recipient_name.toUpperCase()}` : 'Disponível Empresa (Master)'}
                </p>
                <h2 className="text-3xl font-black text-emerald-500 tracking-tighter mt-1">
                  {loadingBalance ? (
                    <span className="inline-block w-32 h-8 bg-brand-white/5 animate-pulse rounded-lg"></span>
                  ) : (
                    formatCurrency(balance?.available || 0)
                  )}
                </h2>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[60px] -mr-16 -mt-16"></div>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Sincronizado com Pagar.me</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-brand-black border-2 border-amber-500/30 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.1)] group"
        >
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_15px_#f59e0b] opacity-50"></div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">A Receber (Lançamentos Futuros)</p>
              <h2 className="text-3xl font-black text-amber-500 tracking-tighter mt-1">
                {loadingBalance ? (
                  <span className="inline-block w-32 h-8 bg-brand-white/5 animate-pulse rounded-lg"></span>
                ) : (
                  formatCurrency(balance?.waiting_funds || 0)
                )}
              </h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[60px] -mr-16 -mt-16"></div>
        </motion.div>
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
        <div className="p-8 border-b border-white/5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 bg-white/[0.01]">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              Histórico de Transações Detalhadas
            </h2>
            <p className="text-xs text-gray-500 mt-1">Busque e filtre por qualquer período, produto ou dados do comprador</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Itens por pág:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'all' ? 'all' : Number(val));
                }}
                className="bg-brand-black border border-white/10 hover:border-emerald-500/30 text-white rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
              >
                <option value={5}>5 itens</option>
                <option value={10}>10 itens</option>
                <option value={15}>15 itens</option>
                <option value={30}>30 itens</option>
                <option value={50}>50 itens</option>
                <option value="all">Ver Todas ({searchFilteredReports.length})</option>
              </select>
            </div>
          </div>
        </div>

        {/* CONTROLS AREA */}
        <div className="px-8 pt-6 pb-2 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Search client input */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-500 group-hover:text-emerald-500/50 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Pesquisar por nome do cliente, e-mail, CPF ou ID da compra..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-brand-black border border-white/10 group-hover:border-emerald-500/30 rounded-2xl pl-11 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-red-500 text-gray-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Date period selector */}
            <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
              {[
                { value: 'all', label: 'Tudo' },
                { value: 'today', label: 'Hoje' },
                { value: '7days', label: '7 Dias' },
                { value: '30days', label: '30 Dias' },
                { value: '90days', label: '90 Dias' },
                { value: 'custom', label: 'Personalizado' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDateFilterType(opt.value as any)}
                  className={`flex-1 min-w-[60px] text-center px-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                    dateFilterType === opt.value
                      ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Picker inputs */}
          <AnimatePresence>
            {dateFilterType === 'custom' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1 overflow-hidden"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Data Inicial</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-brand-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Data Final</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-brand-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Current Search Totals / Quick Summary Bar */}
          <div className="bg-emerald-500/[0.02] border border-emerald-500/10 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Faturamento Bruto</span>
                <span className="text-sm font-extrabold text-white font-mono mt-0.5">{formatCurrency(queryTotals.gross)}</span>
              </div>
              <div className="border-r border-white/5 h-8 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Líquido Consol.</span>
                <span className={`text-sm font-extrabold font-mono mt-0.5 ${queryTotals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(queryTotals.net)}
                </span>
              </div>
              <div className="border-r border-white/5 h-8 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Quantidade</span>
                <span className="text-sm font-extrabold text-gray-300 font-mono mt-0.5">{queryTotals.count} vendas</span>
              </div>
            </div>

            {/* Clear Filters Helper */}
            {(searchTerm || dateFilterType !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setDateFilterType('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-3 py-1.5 rounded-xl border border-red-500/10 bg-red-500/5 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 text-[9px] font-black uppercase tracking-wider transition-all"
              >
                Limpar Filtros de Busca
              </button>
            )}
          </div>
        </div>

        {/* TABLE BODY */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                <th className="px-8 py-4">Produto</th>
                <th className="px-8 py-4">Cliente</th>
                <th className="px-8 py-4">Bruto</th>
                <th className="px-8 py-4 text-orange-500/70">Taxa Pagar.me</th>
                <th className="px-8 py-4 text-yellow-500/70">Comissão (Vendas)</th>
                <th className="px-8 py-4 text-red-500/70">Coprodução</th>
                <th className="px-8 py-4 text-emerald-500">Líquido Insanus</th>
                <th className="px-8 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedReports.map((r) => {
                const {
                  gatewayFee: safeGatewayFee,
                  coproductionPart: safeCoproductionPart,
                  affiliatePart: safeAffiliatePart,
                  netCompanyValue: finalNet
                } = calculateDeductions(r);

                const baseCalculo = r.grossValue - safeGatewayFee;

                const rawCpf = r.customerData?.cpf || (r as any).customer?.document || (r as any).customer?.document_number || '';
                const formattedCpf = rawCpf ? rawCpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '';

                return (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-white group-hover:text-emerald-500 transition-colors">{r.courseName}</p>
                      <p className="text-[10px] font-mono text-gray-600">ID: {r.orderId}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-medium text-gray-300">{r.customerData?.name || (r as any).customer?.name || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{r.customerData?.email || (r as any).customer?.email || 'N/A'}</p>
                      {formattedCpf && (
                        <p className="text-[10px] font-mono text-gray-500 mt-1 uppercase tracking-tight">CPF: {formattedCpf}</p>
                      )}
                    </td>
                    <td className="px-8 py-5 font-mono text-sm text-gray-400">
                      {formatCurrency(r.grossValue)}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-orange-500/80 uppercase">-{formatCurrency(safeGatewayFee)}</span>
                        <span className="text-[9px] text-gray-600">({((safeGatewayFee / r.grossValue) * 100).toFixed(1)}%)</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-yellow-500/80 uppercase">-{formatCurrency(safeAffiliatePart)}</span>
                        {safeAffiliatePart > 0 && <span className="text-[9px] text-gray-600">({((safeAffiliatePart / baseCalculo) * 100).toFixed(1)}%)</span>}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-red-500/80 uppercase">-{formatCurrency(safeCoproductionPart)}</span>
                        {safeCoproductionPart > 0 && <span className="text-[9px] text-gray-600">({((safeCoproductionPart / (baseCalculo - safeAffiliatePart)) * 100).toFixed(1)}%)</span>}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${finalNet >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        <DollarSign className={`w-3 h-3 ${finalNet >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                        <span className={`text-sm font-black font-mono ${finalNet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {finalNet > 0 ? '+' : ''}{formatCurrency(finalNet)}
                        </span>
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
          {paginatedReports.length === 0 && (
            <div className="p-12 text-center text-gray-600 font-medium italic">
              Nenhuma transação localizada nos filtros e busca atuais.
            </div>
          )}
        </div>

        {/* PAGINATION PANEL */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-white/5 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Mostrando <span className="text-white font-black">{Math.min(searchFilteredReports.length, (currentPage - 1) * (pageSize === 'all' ? searchFilteredReports.length : pageSize) + 1)}</span> a <span className="text-white font-black">{Math.min(searchFilteredReports.length, currentPage * (pageSize === 'all' ? searchFilteredReports.length : pageSize))}</span> de <span className="text-emerald-500 font-black">{searchFilteredReports.length}</span> compras
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 rounded-xl text-white transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsisBefore && <span className="text-gray-600 px-1">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-[36px] h-9 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                            currentPage === p
                              ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 rounded-xl text-white transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
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
