
import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Award,
  ArrowUpRight,
  ShoppingBag,
  Clock,
  MessageSquare,
  Mail,
  Wallet,
  Lock,
  ArrowRightCircle,
  Check,
  X
} from 'lucide-react';
import { motion } from 'motion/react';

interface Commission {
  id: string;
  affiliateId: string;
  orderId: string;
  courseId: string;
  courseName: string;
  grossValue: number;
  commissionEarned: number;
  paymentMethod: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  createdAt: string;
}

const AffiliateDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<{ available: number; waiting_funds: number; transferred: number; recipient_name?: string } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [editingRecipientId, setEditingRecipientId] = useState(false);
  const [newRecipientId, setNewRecipientId] = useState('');

  const fetchBalance = async (recipientId: string) => {
    if (!recipientId || recipientId === 'undefined' || recipientId === 'null' || loadingBalance) return;
    
    setLoadingBalance(true);
    try {
      const response = await fetch(`/api/payments/pagarme/balance?recipientId=${recipientId}`);
      if (!response.ok) throw new Error('Falha ao buscar saldo');
      const data = await response.json();
      
      if (data.success && data.balance) {
        setBalance(data.balance);
      }
    } catch (err) {
      console.error('Error fetching real-time balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleUpdateRecipientId = async () => {
    if (!newRecipientId || !currentUser) return;
    
    try {
      setLoadingBalance(true);
      const response = await fetch('/api/users/profile/pagarme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid: currentUser.uid,
          pagarmeRecipientId: newRecipientId.trim()
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setUserProfile((prev: any) => ({ ...prev, pagarmeRecipientId: newRecipientId.trim() }));
        setEditingRecipientId(false);
        fetchBalance(newRecipientId.trim());
      }
    } catch (err) {
      console.error('Error updating recipient ID:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const loadUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserProfile(data);
          if (data.pagarmeRecipientId) {
            fetchBalance(data.pagarmeRecipientId);
          }
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
      }
    };

    loadUserData();

    const q = query(
      collection(db, 'affiliate_commissions'),
      where('affiliateId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Commission[];
      setCommissions(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching commissions:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Cálculos de Resumo
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Início da Semana
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekTime = startOfWeek.getTime();

    // Início do Mês Atual
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    // Período do Mês Passado
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();

    let total = 0;
    let totalToday = 0;
    let totalWeek = 0;
    let totalMonth = 0;
    let totalLastMonth = 0;

    commissions.forEach(c => {
      const time = new Date(c.createdAt).getTime();
      const val = c.commissionEarned / 100; // converter centavos para reais

      total += val;
      if (time >= today) totalToday += val;
      if (time >= weekTime) totalWeek += val;
      if (time >= startOfMonth) totalMonth += val;
      if (time >= startOfLastMonth && time <= endOfLastMonth) totalLastMonth += val;
    });

    return { total, totalToday, totalWeek, totalMonth, totalLastMonth };
  }, [commissions]);

  // Ranking de Produtos
  const productRanking = useMemo(() => {
    const ranking: Record<string, { name: string, total: number, sales: number }> = {};

    commissions.forEach(c => {
      if (!ranking[c.courseId]) {
        ranking[c.courseId] = { name: c.courseName, total: 0, sales: 0 };
      }
      ranking[c.courseId].total += c.commissionEarned / 100;
      ranking[c.courseId].sales += 1;
    });

    return Object.values(ranking).sort((a, b) => b.total - a.total);
  }, [commissions]);

  // Dados para o Gráfico (últimos 15 dias)
  const chartData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      days[dateStr] = 0;
    }

    commissions.forEach(c => {
      const dateStr = new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (days[dateStr] !== undefined) {
        days[dateStr] += c.commissionEarned / 100;
      }
    });

    return Object.entries(days).map(([date, value]) => ({ date, value }));
  }, [commissions]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1 uppercase">
            Meu <span className="text-green-400">Desempenho</span>
          </h1>
          <p className="text-gray-400 text-sm">Acompanhe suas vendas e comissões em tempo real.</p>
        </div>
        <div className="flex items-center gap-4">
          {editingRecipientId ? (
            <div className="flex items-center gap-2 bg-[#1a1a1a] p-1 rounded-xl border border-[#333] animate-in slide-in-from-right-4">
              <input 
                type="text"
                value={newRecipientId}
                onChange={(e) => setNewRecipientId(e.target.value)}
                placeholder="re_..."
                className="bg-transparent border-none text-xs text-white px-3 py-1.5 focus:outline-none w-40 font-mono"
                autoFocus
              />
              <button 
                onClick={handleUpdateRecipientId}
                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                <Check size={14} />
              </button>
              <button 
                onClick={() => setEditingRecipientId(false)}
                className="p-1.5 bg-[#222] hover:bg-[#333] text-gray-400 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                setNewRecipientId(userProfile?.pagarmeRecipientId || '');
                setEditingRecipientId(true);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:scale-105 active:scale-95 ${userProfile?.pagarmeRecipientId ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}
            >
              <div className={`w-2 h-2 rounded-full ${userProfile?.pagarmeRecipientId ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                {userProfile?.pagarmeRecipientId ? (
                  balance?.recipient_name ? `PAGAR.ME: ${balance.recipient_name.toUpperCase()}` : `PAGAR.ME: ${userProfile.pagarmeRecipientId}`
                ) : 'CONECTAR CARTEIRA PAGAR.ME'}
              </span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-2 bg-[#1a1a1a] px-4 py-2 rounded-lg border border-[#333]">
            <Clock className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-300 uppercase font-bold">Atualizado agora</span>
          </div>
        </div>
      </div>

      {/* Account Info Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { 
            label: 'SALDO DISPONÍVEL', 
            value: (balance?.available || 0) / 100, 
            icon: Wallet, 
            color: 'text-green-400',
            isLoading: loadingBalance,
            secondaryLabel: !userProfile?.pagarmeRecipientId ? 'ID NÃO CONFIGURADO' : balance?.recipient_name ? `PAGAR.ME: ${balance.recipient_name.toUpperCase()}` : `RECIPIENTE: ${userProfile.pagarmeRecipientId}`
          },
          { 
            label: 'A RECEBER', 
            value: (balance?.waiting_funds || 0) / 100, 
            icon: Lock, 
            color: 'text-amber-400',
            isLoading: loadingBalance 
          },
          { 
            label: 'TOTAL SACADO (BAIXADO)', 
            value: (balance?.transferred || 0) / 100, 
            icon: ArrowRightCircle, 
            color: 'text-blue-400',
            isLoading: loadingBalance 
          },
        ].map((item, i) => (
          <div key={i} className="bg-[#111] p-5 rounded-xl border border-[#222] relative overflow-hidden group hover:border-[#333] transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div className={`p-1.5 rounded-lg ${
                item.label === 'A RECEBER' ? 'bg-amber-400/10' : 
                item.label === 'TOTAL SACADO (BAIXADO)' ? 'bg-blue-400/10' : 
                'bg-green-400/10'
              }`}>
                <item.icon size={16} className={
                  item.label === 'A RECEBER' ? 'text-amber-400' : 
                  item.label === 'TOTAL SACADO (BAIXADO)' ? 'text-blue-400' : 
                  'text-green-400'
                } />
              </div>
            </div>
            <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase mb-1">{item.label}</p>
            <h3 className={`text-xl font-black tracking-tighter ${item.color}`}>
              {item.isLoading ? (
                <span className="text-xs font-medium animate-pulse text-gray-600">Sincronizando...</span>
              ) : (
                formatCurrency(item.value)
              )}
            </h3>
            {item.secondaryLabel && (
              <p className="text-[8px] text-gray-600 font-bold uppercase mt-1 truncate">{item.secondaryLabel}</p>
            )}
          </div>
        ))}
      </div>

      {/* Performance Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Hoje', value: stats.totalToday, icon: Clock, color: 'text-emerald-400' },
          { label: 'Semana', value: stats.totalWeek, icon: Calendar, color: 'text-emerald-400' },
          { label: 'Mês Atual', value: stats.totalMonth, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Mês Passado', value: stats.totalLastMonth, icon: TrendingUp, color: 'text-gray-400' },
          { label: 'Acumulado Total', value: stats.total, icon: DollarSign, color: 'text-green-400' },
        ].map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-[#0a0a0a] p-4 rounded-xl border border-[#222]/50 relative group hover:bg-[#111] transition-all ${
              item.label === 'Mês Passado' ? 'bg-zinc-900/10' : 'bg-green-500/[0.02]'
            }`}
          >
            <p className="text-[8px] text-gray-500 font-black tracking-widest uppercase mb-2 flex items-center gap-2">
              <item.icon size={10} className="text-gray-600" />
              {item.label}
            </p>
            <h4 className={`text-lg font-black tracking-tighter ${item.color}`}>
              {formatCurrency(item.value)}
            </h4>
            {item.label === 'Mês Atual' && stats.totalLastMonth > 0 && (
              <div className={`text-[8px] font-black mt-1 uppercase flex items-center gap-1 ${stats.totalMonth >= stats.totalLastMonth ? 'text-green-500' : 'text-red-500'}`}>
                {stats.totalMonth >= stats.totalLastMonth ? '↑ Crescimento' : '↓ Queda'}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Evolução */}
        <div className="lg:col-span-2 bg-[#111] p-6 rounded-xl border border-[#222]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Evolução de Ganhos
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#444" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#444" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R$${val}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#4ade80' }}
                  formatter={(val: number) => [formatCurrency(val), 'Comissão']}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#4ade80" 
                  strokeWidth={3} 
                  dot={{ fill: '#4ade80', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking de Produtos */}
        <div className="bg-[#111] p-6 rounded-xl border border-[#222]">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
            <Award className="w-5 h-5 text-green-400" />
            Top Produtos
          </h3>
          <div className="space-y-4">
            {productRanking.length > 0 ? productRanking.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a1a] border border-[#222] hover:border-green-400/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-400/10 flex items-center justify-center text-xs font-bold text-green-400 border border-green-400/20">
                    {i + 1}º
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white line-clamp-1 uppercase tracking-tight">{p.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">{p.sales} vendas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-400">{formatCurrency(p.total)}</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-12">
                <ShoppingBag className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                <p className="text-sm text-gray-600 uppercase font-black tracking-widest">Sem vendas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-[#111] rounded-xl border border-[#222] overflow-hidden">
        <div className="p-6 border-b border-[#222]">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
            <Clock className="w-5 h-5 text-green-400" />
            Vendas Recentes
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#1a1a1a] text-gray-500 text-[10px] uppercase tracking-widest font-black">
              <tr>
                <th className="px-6 py-4 font-medium">Produto</th>
                <th className="px-6 py-4 font-medium">Cliente</th>
                <th className="px-6 py-4 font-medium">Contato</th>
                <th className="px-6 py-4 font-medium text-center">Data</th>
                <th className="px-6 py-4 font-medium text-center">Pagamento</th>
                <th className="px-6 py-4 font-medium">Valor Bruto</th>
                <th className="px-6 py-4 font-medium text-right">Comissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {commissions.slice(0, 10).map((c, i) => (
                <tr key={i} className="hover:bg-[#1a1a1a]/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-white line-clamp-1 uppercase tracking-tight">{c.courseName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-black text-gray-200 uppercase tracking-tight truncate max-w-[150px]">{c.customerName || 'N/A'}</span>
                      <span className="text-[9px] text-gray-500 font-medium flex items-center gap-1 uppercase">
                        <Mail size={10} /> {c.customerEmail || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {c.customerPhone && c.customerPhone !== 'N/A' ? (
                      <a 
                        href={`https://wa.me/${c.customerPhone.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/20 transition-all group w-fit"
                      >
                        <MessageSquare size={12} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-black uppercase">Chamar</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-zinc-700 italic font-bold uppercase tracking-tighter">Sem fone</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-[10px] font-black text-gray-400 text-center uppercase tracking-widest whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#222] text-gray-400 border border-[#333]">
                      {c.paymentMethod}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-gray-400">
                    {formatCurrency(c.grossValue / 100)}
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-green-400 text-right uppercase tracking-tight">
                    {formatCurrency(c.commissionEarned / 100)}
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-600 uppercase font-black tracking-[.2em] text-[10px]">
                    Nenhum registro de comissão encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AffiliateDashboard;
