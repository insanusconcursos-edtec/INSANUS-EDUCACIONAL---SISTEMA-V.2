import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  onSnapshot,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Filter, 
  Package,
  AlertCircle,
  User,
  Wallet,
  ArrowRightCircle,
  Lock,
  Clock,
  ShoppingBag,
  Calendar,
  ChevronDown,
  Smartphone,
  Download,
  X,
  Check
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { motion } from 'motion/react';
import { Coproducer } from '../../types/coproducer';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface Commission {
  id: string;
  coproducerId: string;
  coproducerName: string;
  orderId: string;
  courseId: string;
  courseName: string;
  commissionValue: number;
  createdAt: string;
}

interface ProductInfo {
  id: string;
  name: string;
  coproduction: any[];
  offers?: any[];
}

interface CoproducerGain {
  id: string;
  name: string;
  email: string;
  totalGained: number;
  percentage?: number; // Specific to a product if selected
  salesCount: number;
}

interface CoproducerUser {
  uid: string;
  name: string;
  email: string;
  role: string;
}

import { usePushNotifications } from '../../hooks/usePushNotifications';

const CoproductionDashboard: React.FC = () => {
  const { currentUser, userRole } = useAuth();
  
  // Register for push notifications
  usePushNotifications();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  
  useEffect(() => {
    fetch('/api/admin/backfill-sales').catch(console.error);
  }, []);

  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [coproducerUsers, setCoproducerUsers] = useState<CoproducerUser[]>([]);
  const [managedCoproducers, setManagedCoproducers] = useState<Coproducer[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<{ available: number; waiting_funds: number; recipient_name?: string } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const isCoprodutorRole = userRole === 'COPRODUTOR';
  const [editingRecipientId, setEditingRecipientId] = useState(false);
  const [newRecipientId, setNewRecipientId] = useState('');

  const { isInstallable, installApp } = usePWAInstall();

  // Date Filtering State
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'month' | 'custom'>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [withdrawalsAmount, setWithdrawalsAmount] = useState<number>(0);

  const dateFilter = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (dateRange) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        if (customStartDate) start = new Date(customStartDate);
        if (customEndDate) {
          end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
        }
        break;
    }
    return { start, end };
  }, [dateRange, customStartDate, customEndDate]);

  // Helper to check if a commission is in range
  const isDateInRange = (dateStr: string, start: Date, end: Date) => {
    const d = new Date(dateStr);
    return d >= start && d <= end;
  };

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
        toast.success('ID Pagar.me atualizado com sucesso!');
        setUserProfile((prev: any) => ({ ...prev, pagarmeRecipientId: newRecipientId.trim() }));
        setEditingRecipientId(false);
        fetchBalance(newRecipientId.trim());
      } else {
        toast.error('Erro ao atualizar ID: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      toast.error('Erro de conexão ao atualizar ID.');
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!userProfile?.pagarmeRecipientId || !balance?.available || balance.available <= 0) return;

    setRequestingPayout(true);
    setPayoutMessage(null);

    try {
      const response = await fetch('/api/payments/pagarme/request-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: userProfile.pagarmeRecipientId,
          amount: balance.available
        })
      });

      const data = await response.json();

      if (data.success) {
        const liquidFormatted = (data.transfer?.liquidAmount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const feeFormatted = (data.transfer?.fee / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        setPayoutMessage({
          type: 'success',
          text: `Saque de R$ ${liquidFormatted} solicitado (Desconto de R$ ${feeFormatted} de taxa aplicado). O valor cairá em sua conta conforme o prazo bancário.`
        });
        // Refresh balance after payout
        fetchBalance(userProfile.pagarmeRecipientId);
        setTimeout(() => {
          setShowPayoutModal(false);
          setPayoutMessage(null);
        }, 3000);
      } else {
        setPayoutMessage({
          type: 'error',
          text: data.error || 'Erro ao processar o saque.'
        });
      }
    } catch (err) {
      console.error('Error requesting payout:', err);
      setPayoutMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    } finally {
      setRequestingPayout(false);
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
    
    setLoading(true);
    
    // 1. Fetch all baseline data
    const fetchBaseData = async () => {
      try {
        const [prodSnap, legacyProdSnap, userSnap, managedSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'ticto_products')),
          getDocs(query(collection(db, 'users'), where('role', 'in', ['coprodutor', 'COPRODUTOR', 'coproducer', 'COPRODUCER']))),
          getDocs(collection(db, 'coproducers'))
        ]);

        const allProducts: ProductInfo[] = [
          ...prodSnap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || 'Produto sem nome',
              coproduction: data.coproduction || data.splits || data.coproducers || [],
              offers: data.offers || []
            };
          }),
          ...legacyProdSnap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || 'Produto sem nome',
              coproduction: data.coproduction || data.splits || data.coproducers || [],
              offers: data.offers || []
            };
          })
        ];

        // Ensure unique IDs if there's any overlap (unlikely if they migrated)
        const uniqueProducts = Array.from(new Map(allProducts.map(p => [p.id, p])).values());
        
        let filteredProducts = uniqueProducts;
        if (isCoprodutorRole && currentUser) {
          filteredProducts = uniqueProducts.filter(p => {
            const userUid = currentUser.uid;
            const userEmail = currentUser.email?.toLowerCase();
            
            // Check top level
            const inTopLevel = p.coproduction.some((cp: any) => 
              (cp.coproducerId || cp.userId || cp.id || cp.uid) === userUid ||
              (userEmail && (cp.coproducerEmail || cp.email)?.toLowerCase() === userEmail)
            );

            // Check offers
            const inOffers = (p.offers || []).some((off: any) => 
              (off.coproducers || off.coproduction || []).some((cp: any) => 
                (cp.coproducerId || cp.userId || cp.id || cp.uid) === userUid ||
                (userEmail && (cp.coproducerEmail || cp.email)?.toLowerCase() === userEmail)
              )
            );

            return inTopLevel || inOffers;
          });
        }
        
        setProducts(filteredProducts);

        // If only one product, select it by default
        if (isCoprodutorRole && filteredProducts.length === 1) {
          setSelectedProductId(filteredProducts[0].id);
        }

        const users: CoproducerUser[] = userSnap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as CoproducerUser));
        setCoproducerUsers(users);

        const managed: Coproducer[] = managedSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Coproducer));
        setManagedCoproducers(managed);

      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchBaseData();

    // 2. Listen to commissions (Filtered if Coprodutor)
    const commissionsCollection = collection(db, 'coproduction_commissions');
    let commissionsQuery;
    
    if (isCoprodutorRole) {
      // Para coprodutores, buscamos tanto pelo UID quanto pelo RecipientId (se disponível na sessão atual)
      const identifiers = [currentUser.uid];
      if (userProfile?.pagarmeRecipientId) {
        identifiers.push(userProfile.pagarmeRecipientId);
      }

      commissionsQuery = query(
        commissionsCollection, 
        where('coproducerId', 'in', identifiers)
      );
    } else {
      commissionsQuery = commissionsCollection;
    }

    const unsubscribeComms = onSnapshot(commissionsQuery, 
      (snapshot) => {
        const comms: Commission[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Commission));
        setCommissions(comms);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to commissions:', err);
        setError('Falha ao carregar relatório. Verifique suas permissões.');
        setLoading(false);
      }
    );

    const unsubscribeWithdrawals = () => {};
    if (isCoprodutorRole && currentUser) {
      // Usamos recipientId se já estiver carregado (do fetchBalance antigo) ou uid
      // Para manter tudo reativo, podemos assinar withdrawals via userProfile
    }

    return () => {
      unsubscribeComms();
      unsubscribeWithdrawals();
    };
  }, [currentUser, dateFilter, isCoprodutorRole, userProfile?.pagarmeRecipientId]); 

  // Efeito para sincronizar saldo real da Pagar.me
  useEffect(() => {
    if (!userProfile?.pagarmeRecipientId || !currentUser) return;
    
    // Busca inicial do saldo real
    fetchBalance(userProfile.pagarmeRecipientId);

    // 1. Assinatura de Saques (Mantemos para integridade local de lançamentos)
    const wQuery = query(
      collection(db, 'withdrawals'), 
      where('recipientId', '==', userProfile.pagarmeRecipientId)
    );
    const unsubscribeWithdrawals = onSnapshot(wQuery, (snap) => {
      let totalWd = 0;
      snap.forEach(doc => totalWd += (doc.data().amount || 0));
      setWithdrawalsAmount(totalWd);
    });

    return () => {
      unsubscribeWithdrawals();
    };
  }, [userProfile?.pagarmeRecipientId, currentUser]);



  // Main Logic: Group gains by Coproducer
  const coproducerGains = useMemo(() => {
    const map = new Map<string, CoproducerGain>();

    // Step 1: Build the pool of target coproducers
    let allCoproducers: Array<{id: string; name: string; email: string; percentage?: number}> = [];

    if (isCoprodutorRole) {
      allCoproducers.push({
        id: currentUser.uid,
        name: userProfile?.name || 'Eu',
        email: userProfile?.email || ''
      });
    } else if (selectedProductId === 'all') {
      // Logic for ALL: Users with role 'coprodutor' OR mentioned in any split
      const seen = new Set();

      // Add users with the role
      coproducerUsers.forEach(u => {
        if (!seen.has(u.uid)) {
          seen.add(u.uid);
          allCoproducers.push({
            id: u.uid,
            name: u.name,
            email: u.email
          });
        }
      });

      // Add managed coproducers from the explicit collection
      managedCoproducers.forEach(m => {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          allCoproducers.push({
            id: m.id,
            name: m.name,
            email: m.email
          });
        }
      });

      // Add users mentioned in product splits (might not have the role but are coproducers for a product)
      products.forEach(p => {
        const pool = [...p.coproduction];
        (p.offers || []).forEach((off: any) => {
          pool.push(...(off.coproducers || off.coproduction || []));
        });

        pool.forEach(cp => {
          const cid = cp.coproducerId || cp.userId || cp.id || cp.uid;
          if (cid && !seen.has(cid)) {
            seen.add(cid);
            allCoproducers.push({
              id: cid,
              name: cp.coproducerName || cp.name || 'Parceiro',
              email: cp.coproducerEmail || cp.email || ''
            });
          }
        });
      });
    } else {
      // Logic for SPECIFIC PRODUCT: Only those explicitly in the split of this product
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        const pool = [...product.coproduction];
        (product.offers || []).forEach((off: any) => {
          pool.push(...(off.coproducers || off.coproduction || []));
        });

        allCoproducers = pool.map(cp => ({
          id: cp.coproducerId || cp.userId || cp.id || cp.uid,
          name: cp.coproducerName || cp.name || 'Parceiro',
          email: cp.coproducerEmail || cp.email || '',
          percentage: cp.percentage
        }));
      }
    }

    // 1. Filtro de Existência: Garante que APENAS usuários com nome válido e ID sejam processados
    const validCoproducers = allCoproducers.filter(cp => cp.name && cp.name.trim() !== "" && cp.id);

    // Initialize map with target coproducers
    validCoproducers.forEach(cp => {
      map.set(cp.id, {
        id: cp.id,
        name: cp.name,
        email: cp.email,
        totalGained: 0,
        percentage: cp.percentage,
        salesCount: 0
      });
    });

    // Step 2: Aggregate commissions
    commissions.forEach(comm => {
      // 2. Verificação de ID nulo: Ignorar comissões sem ID de coprodutor
      if (!comm.coproducerId) return;

      // Filter by Date
      if (!isDateInRange(comm.createdAt, dateFilter.start, dateFilter.end)) return;

      // If filtering by product, ignore other products
      if (selectedProductId !== 'all' && comm.courseId !== selectedProductId) return;

      // Match commission with coproducer
      let gainObj = map.get(comm.coproducerId);
      
      // Se não estiver no mapa (ex: parceiro antigo ou ID não mapeado), adiciona dinamicamente
      if (!gainObj) {
        const knownUser = coproducerUsers.find(u => u.uid === comm.coproducerId);
        const managed = managedCoproducers.find(m => m.id === comm.coproducerId);
        
        gainObj = {
          id: comm.coproducerId,
          name: comm.coproducerName || knownUser?.name || managed?.name || 'Parceiro (ID)',
          email: knownUser?.email || managed?.email || 'N/A',
          totalGained: 0,
          salesCount: 0
        };
        map.set(comm.coproducerId, gainObj);
      }

      const val = Number(comm.commissionValue) || 0;
      gainObj.totalGained += val;
      gainObj.salesCount += 1;
    });

    // 3. Ordenação: Maior faturamento primeiro
    return Array.from(map.values()).sort((a, b) => b.totalGained - a.totalGained);
  }, [commissions, products, coproducerUsers, managedCoproducers, selectedProductId, dateFilter]);

  const globalStats = useMemo(() => {
    // All-time commissions for accumulated total
    const allTimeComms = commissions.filter(c => {
      const matchProduct = selectedProductId === 'all' || c.courseId === selectedProductId;
      return matchProduct;
    });
    const allTimeTotal = allTimeComms.reduce((acc, c) => acc + (Number(c.commissionValue) || 0), 0);

    // Current period
    const relevantComms = commissions.filter(c => {
      const matchProduct = selectedProductId === 'all' || c.courseId === selectedProductId;
      const matchDate = isDateInRange(c.createdAt, dateFilter.start, dateFilter.end);
      return matchProduct && matchDate;
    });

    // Previous period (for growth calculation)
    const duration = dateFilter.end.getTime() - dateFilter.start.getTime();
    const prevStart = new Date(dateFilter.start.getTime() - duration);
    const prevEnd = new Date(dateFilter.end.getTime() - duration);

    const prevComms = commissions.filter(c => {
      const matchProduct = selectedProductId === 'all' || c.courseId === selectedProductId;
      const matchDate = isDateInRange(c.createdAt, prevStart, prevEnd);
      return matchProduct && matchDate;
    });

    const total = relevantComms.reduce((acc, c) => acc + (Number(c.commissionValue) || 0), 0);
    const prevTotal = prevComms.reduce((acc, c) => acc + (Number(c.commissionValue) || 0), 0);
    
    const growth = prevTotal === 0 
      ? (total > 0 ? 100 : 0) 
      : ((total - prevTotal) / prevTotal) * 100;

    const count = relevantComms.length;
    const uniqueCoproducers = new Set(relevantComms.map(c => c.coproducerId)).size;
    const uniqueProducts = new Set(relevantComms.map(c => c.courseId)).size;

    return {
      total: total / 100,
      allTimeTotal: allTimeTotal / 100,
      count,
      uniqueCoproducers,
      uniqueProducts,
      growth
    };
  }, [commissions, selectedProductId, dateFilter]);

  // Dynamic Chart Data based on filtered commissions and date range
  const chartData = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const days: Record<string, number> = {};
    const start = new Date(dateFilter.start);
    const end = new Date(dateFilter.end);
    
    // IF mobile and range is large, show only last 7 days for better visualization
    let effectiveStart = start;
    if (isMobile) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setHours(0, 0, 0, 0);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Today + 6 back = 7 days
      
      // Only cap if the selected filter is longer than 7 days
      if (start < sevenDaysAgo) {
        effectiveStart = sevenDaysAgo;
      }
    }

    // Fill the range with zeroes
    const temp = new Date(effectiveStart);
    while (temp <= end) {
      const dateStr = temp.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      days[dateStr] = 0;
      temp.setDate(temp.getDate() + 1);
      
      // Safety break for long ranges
      if (Object.keys(days).length > 60) break; 
    }

    commissions.forEach(c => {
      if (!isDateInRange(c.createdAt, effectiveStart, end)) return;
      if (selectedProductId !== 'all' && c.courseId !== selectedProductId) return;

      const dateStr = new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (days[dateStr] !== undefined) {
        days[dateStr] += (Number(c.commissionValue) || 0) / 100;
      }
    });

    return Object.entries(days).map(([date, value]) => ({ date, value }));
  }, [commissions, dateFilter, selectedProductId]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (isCoprodutorRole) {
    return (
      <div className="space-y-6 md:space-y-8 pb-12">
        {/* PWA INSTALL BANNER */}
        {isInstallable && (
          <div className="bg-green-400/10 border border-green-400/20 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4 text-center sm:text-left text-white">
              <div className="p-3 bg-green-400 rounded-xl shrink-0">
                <Smartphone className="w-6 h-6 text-black" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider">Acesse como Aplicativo</h4>
                <p className="text-xs text-gray-400 font-medium">Instale para acompanhar sua coprodução com mais agilidade.</p>
              </div>
            </div>
            <button 
              onClick={installApp}
              className="w-full sm:w-auto px-6 py-3 bg-green-400 text-black font-black uppercase text-[11px] tracking-widest rounded-xl hover:bg-green-500 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              INSTALAR AGORA
            </button>
          </div>
        )}
        {/* Header Section */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase flex items-center gap-3">
                <div className="p-2 bg-green-400 rounded-xl md:hidden">
                  <Wallet className="w-5 h-5 text-black" />
                </div>
                Minha <span className="text-green-400">Coprodução</span>
              </h1>
              <p className="text-gray-400 text-xs md:text-sm font-medium">Acompanhe seus ganhos e saldo em tempo real.</p>
            </div>
            <div className="flex items-center gap-3">
              {editingRecipientId ? (
                <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800 animate-in slide-in-from-right-4">
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
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-gray-400 rounded-lg transition-colors"
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
            </div>
          </div>

          {/* Toolbar - Dark Glass Style */}
          <div className="bg-[#111] border border-[#222] p-2 md:p-2.5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-center gap-2 flex-grow">
              {/* Product Filter */}
              <div className="relative w-full sm:w-auto min-w-[200px]">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-[#1a1a1a] border border-[#222] rounded-xl text-white focus:outline-none focus:border-green-400/50 transition-all appearance-none cursor-pointer text-[10px] font-black uppercase tracking-widest"
                >
                  <option value="all">📊 TODOS OS PRODUTOS</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{(p.name || 'Sem Nome').toUpperCase()}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4 pointer-events-none" />
              </div>

              {/* Date Filter */}
              <div className="relative w-full sm:w-auto min-w-[200px]">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="w-full pl-10 pr-10 py-3 bg-[#1a1a1a] border border-[#222] rounded-xl text-white focus:outline-none focus:border-green-400/50 transition-all appearance-none cursor-pointer text-[10px] font-black uppercase tracking-widest"
                >
                  <option value="today">HOJE</option>
                  <option value="7d">ÚLTIMOS 7 DIAS</option>
                  <option value="30d">ÚLTIMOS 30 DIAS</option>
                  <option value="month">ESTE MÊS</option>
                  <option value="custom">INTERVALO PERSONALIZADO</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4 pointer-events-none" />
              </div>

              {dateRange === 'custom' && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-[#1a1a1a] border border-[#222] rounded-xl px-3 py-3 text-[10px] text-white font-black uppercase"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-[#1a1a1a] border border-[#222] rounded-xl px-3 py-3 text-[10px] text-white font-black uppercase"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Saldo Disponível */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#111] p-6 rounded-xl border border-[#222] relative overflow-hidden group hover:border-green-400/30 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-green-400/10 rounded-lg">
                <Wallet className="w-5 h-5 text-green-400" />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 font-bold tracking-[0.2em] uppercase mb-1">Saldo Disponível</p>
            <h3 className="text-2xl font-black text-green-400 tracking-tighter">
              {loadingBalance ? (
                <span className="text-xs font-medium animate-pulse text-gray-500">Sincronizando...</span>
              ) : !userProfile?.pagarmeRecipientId ? (
                <span className="text-xs font-medium text-red-500/50">Configure seu ID</span>
              ) : formatCurrency((balance?.available || 0) / 100)}
            </h3>
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <Wallet className="w-24 h-24" />
            </div>
          </motion.div>

          {/* Card 2: A Receber */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-[#111] p-6 rounded-xl border border-[#222] relative overflow-hidden group hover:border-amber-400/30 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-amber-400/10 rounded-lg">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 font-bold tracking-[0.2em] uppercase mb-1">A Receber</p>
            <h3 className="text-2xl font-black text-amber-400 tracking-tighter">
              {loadingBalance ? (
                <span className="text-xs font-medium animate-pulse text-gray-500">Calculando...</span>
              ) : !userProfile?.pagarmeRecipientId ? (
                <span className="text-xs font-medium text-red-500/50">Configure seu ID</span>
              ) : formatCurrency((balance?.waiting_funds || 0) / 100)}
            </h3>
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <Lock className="w-24 h-24" />
            </div>
          </motion.div>

          {/* Card 3: Sacado (Transferred) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-[#111] p-6 rounded-xl border border-[#222] relative overflow-hidden group hover:border-blue-400/30 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-400/10 rounded-lg">
                <ArrowRightCircle className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 font-bold tracking-[0.2em] uppercase mb-1">Total Sacado (Baixado)</p>
            <h3 className="text-2xl font-black text-white tracking-tighter">
              {loadingBalance ? (
                <span className="text-xs font-medium animate-pulse text-gray-500">Buscando...</span>
              ) : formatCurrency(((balance as any)?.transferred || 0) / 100)}
            </h3>
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <ArrowRightCircle className="w-24 h-24" />
            </div>
          </motion.div>

          {/* Card 4: Comissão Total */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-[#111] p-6 rounded-xl border border-[#222] relative overflow-hidden group hover:border-green-400/30 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-green-400/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 font-bold tracking-[0.2em] uppercase mb-1">Comissão Acumulada</p>
            <h3 className="text-2xl font-black text-green-400 tracking-tighter">
              {formatCurrency(globalStats.allTimeTotal)}
            </h3>
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <DollarSign className="w-24 h-24" />
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Gráfico de Evolução */}
          <div className="bg-[#111] p-5 md:p-6 rounded-xl border border-[#222]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Evolução de Ganhos
              </h3>
              <span className="text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest hidden sm:block">
                {window.innerWidth < 768 ? 'Últimos 7 dias' : 'Consolidado'}
              </span>
            </div>
            <div className="h-[250px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#444" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    interval={window.innerWidth < 768 ? 0 : 'preserveStartEnd'}
                  />
                  <YAxis hide={window.innerWidth < 480} stroke="#444" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px' }}
                    itemStyle={{ color: '#4ade80', fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(val: number) => [formatCurrency(val), 'Comissão']}
                  />
                  <Line 
                    type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={3} 
                    dot={{ fill: '#4ade80', strokeWidth: 1.5, r: 3 }} activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-[#1a1a1a] text-gray-500 text-[10px] uppercase tracking-widest font-black">
                <tr>
                  <th className="px-6 py-4 font-black">Produto</th>
                  <th className="px-6 py-4 font-black text-center">Data</th>
                  <th className="px-6 py-4 font-black text-right">Minha Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {commissions
                  .filter(c => selectedProductId === 'all' || c.courseId === selectedProductId)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 50)
                  .map((c, i) => (
                    <tr key={i} className="hover:bg-[#1a1a1a]/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-white line-clamp-1 uppercase tracking-tight">{c.courseName}</p>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-black text-gray-400 text-center uppercase tracking-widest whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-green-400 text-right uppercase tracking-tight">
                        {formatCurrency(c.commissionValue / 100)}
                      </td>
                    </tr>
                ))}
                {commissions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-700 uppercase font-black tracking-widest text-[10px]">
                      Nenhuma comissão registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-[#222] flex flex-col items-center gap-2">
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Sincronizado com Pagar.me em tempo real
          </p>
        </div>

        {/* Reuse Modals */}
        {showPayoutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#111] border border-[#222] rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-400/10 flex items-center justify-center border border-green-400/20">
                  <Wallet className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white uppercase tracking-tight">Confirmar Saque</h3>
                
                <div className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl p-4 my-2 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 text-left">Valor Bruto Solicitado:</span>
                    <span className="text-white font-medium">{formatCurrency((balance?.available || 0) / 100)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-400/80 text-left">Taxa de Transferência:</span>
                    <span className="text-red-400/80 font-medium">- R$ 3,67</span>
                  </div>
                  <div className="w-full h-px bg-[#333] my-1"></div>
                  <div className="flex justify-between items-center font-black">
                    <span className="text-green-400 uppercase tracking-tight text-left">Você Recebe:</span>
                    <span className="text-green-400 text-xl">{formatCurrency(Math.max(0, (balance?.available || 0) - 367) / 100)}</span>
                  </div>
                </div>

                <p className="text-gray-500 text-xs font-medium mt-2">
                  O valor líquido será enviado para a sua conta bancária cadastrada na Pagar.me.
                </p>

                {payoutMessage && (
                  <div className={`w-full p-4 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    payoutMessage.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {payoutMessage.text}
                  </div>
                )}

                <div className="flex gap-4 w-full mt-4">
                  <button
                    onClick={() => { setShowPayoutModal(false); setPayoutMessage(null); }}
                    disabled={requestingPayout}
                    className="flex-1 py-3 rounded-xl bg-[#222] text-gray-500 font-bold uppercase text-[10px] tracking-widest hover:bg-[#2a2a2a] transition-colors border border-[#333]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRequestPayout}
                    disabled={requestingPayout}
                    className="flex-1 py-3 rounded-xl bg-green-400 text-black font-black uppercase text-[10px] tracking-widest hover:bg-green-500 transition-all shadow-lg shadow-green-400/20"
                  >
                    {requestingPayout ? 'Processando' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12" id="admin-coproduction-dashboard">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
            {isCoprodutorRole ? "Minha Coprodução" : "Painel Geral de Coprodução"}
          </h1>
          <p className="text-gray-400 mt-1 font-medium italic">
            {isCoprodutorRole 
              ? "Acompanhe suas vendas, comissões e saldo disponível em tempo real." 
              : "Gestão centralizada de participações e comissões de parceiros."}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="pl-10 pr-8 py-2 bg-brand-dark/50 border border-brand-white/10 rounded-lg text-white focus:outline-none focus:border-brand-blue transition-all appearance-none cursor-pointer font-medium"
            >
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="month">Mês Atual</option>
              <option value="custom">📅 Personalizado</option>
            </select>
          </div>

          <div className="relative group">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 transition-colors group-hover:text-brand-blue" />
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="pl-10 pr-8 py-2 bg-brand-dark/50 border border-brand-white/10 rounded-lg text-white focus:outline-none focus:border-brand-blue transition-all appearance-none cursor-pointer min-w-[200px] font-medium"
            >
              <option value="all">📊 Todos os Produtos</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {dateRange === 'custom' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-dark/30 p-4 rounded-xl border border-brand-white/5 flex flex-wrap gap-4 items-end"
        >
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Início</p>
            <input 
              type="date" 
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-brand-black border border-brand-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Fim</p>
            <input 
              type="date" 
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-brand-black border border-brand-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
        </motion.div>
      )}

      {/* Wallet / Balance Section */}
      {isCoprodutorRole && userProfile?.pagarmeRecipientId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-brand-dark border-2 border-emerald-500/30 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)] group"
          >
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_15px_#10b981] opacity-50"></div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <Wallet className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Disponível para Saque</p>
                  <h2 className="text-3xl font-black text-emerald-500 tracking-tighter mt-1">
                    {loadingBalance ? (
                      <span className="inline-block w-32 h-8 bg-brand-white/5 animate-pulse rounded-lg"></span>
                    ) : (
                      `R$ ${((balance?.available || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    )}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setShowPayoutModal(true)}
                disabled={!balance?.available || balance.available <= 0 || loadingBalance || requestingPayout}
                className={`py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  (!balance?.available || balance.available <= 0 || loadingBalance || requestingPayout)
                    ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-50'
                    : 'bg-emerald-600 text-white shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:bg-emerald-500'
                }`}
              >
                {requestingPayout ? '...' : 'Sacar'}
                <ArrowRightCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[60px] -mr-16 -mt-16"></div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-brand-dark border-2 border-amber-500/30 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.1)] group"
          >
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_15px_#f59e0b] opacity-50"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                <Lock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">A Receber (Lançamentos)</p>
                <h2 className="text-3xl font-black text-amber-500 tracking-tighter mt-1">
                  {loadingBalance ? (
                    <span className="inline-block w-32 h-8 bg-brand-white/5 animate-pulse rounded-lg"></span>
                  ) : (
                    `R$ ${((balance?.waiting_funds || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  )}
                </h2>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[60px] -mr-16 -mt-16"></div>
          </motion.div>
        </div>
      )}

      {/* Payout Confirmation Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/95 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-brand-dark border-2 border-brand-blue/30 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(45,124,255,0.2)]"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-brand-blue/20 flex items-center justify-center border border-brand-blue/30 shadow-[0_0_20px_rgba(45,124,255,0.2)]">
                <Wallet className="w-10 h-10 text-brand-blue" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Confirmar Saque</h3>
              
              <div className="w-full bg-brand-white/5 border border-brand-white/10 rounded-2xl p-5 my-2 flex flex-col gap-3">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-gray-400 text-left">Valor Bruto Solicitado:</span>
                  <span className="text-white">R$ {((balance?.available || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-red-400/80 text-left">Taxa de Transferência:</span>
                  <span className="text-red-400/80">- R$ 3,67</span>
                </div>
                <div className="w-full h-px bg-brand-white/10 my-2"></div>
                <div className="flex justify-between items-center font-black">
                  <span className="text-brand-blue uppercase tracking-tighter text-left">Você Recebe:</span>
                  <span className="text-brand-blue text-2xl">R$ {(Math.max(0, (balance?.available || 0) - 367) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <p className="text-gray-500 text-xs font-medium">
                O valor líquido será enviado para a sua conta bancária cadastrada na Pagar.me.
              </p>

              {payoutMessage && (
                <div className={`w-full p-4 rounded-xl text-sm font-bold uppercase tracking-widest ${
                  payoutMessage.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                }`}>
                  {payoutMessage.text}
                </div>
              )}

              <div className="flex gap-4 w-full mt-4">
                <button
                  onClick={() => {
                    setShowPayoutModal(false);
                    setPayoutMessage(null);
                  }}
                  disabled={requestingPayout}
                  className="flex-1 py-4 rounded-xl bg-brand-white/5 text-gray-400 font-bold uppercase tracking-widest hover:bg-brand-white/10 transition-colors border border-brand-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRequestPayout}
                  disabled={requestingPayout}
                  className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
                    requestingPayout 
                      ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed' 
                      : 'bg-brand-blue text-white shadow-[0_10px_20px_rgba(45,124,255,0.2)]'
                  }`}
                >
                  {requestingPayout ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  ) : 'Confirmar'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-500">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      ) : null}

      {/* Global Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-dark/40 backdrop-blur-md border border-brand-white/10 p-6 rounded-2xl relative overflow-hidden group"
        >
          <div className="absolute -top-4 -right-4 bg-brand-blue/10 w-24 h-24 rounded-full blur-3xl group-hover:bg-brand-blue/20 transition-all"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-brand-blue/20 p-3 rounded-xl border border-brand-blue/30 shadow-lg shadow-brand-blue/20">
              <DollarSign className="w-6 h-6 text-brand-blue" />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Total Distribuído</p>
              <h2 className="text-3xl font-black text-white mt-0.5">
                R$ {globalStats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
            </div>
          </div>
          <div className="pt-4 border-t border-brand-white/5 flex items-center justify-between">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Valor Líquido Coprodutores</span>
            <span className={`font-bold text-xs ${globalStats.growth >= 0 ? 'text-brand-blue' : 'text-red-500'}`}>
              {globalStats.growth >= 0 ? '+' : ''}{globalStats.growth.toFixed(1)}% vs ant.
            </span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-brand-dark/40 backdrop-blur-md border border-brand-white/10 p-6 rounded-2xl relative overflow-hidden group"
        >
          <div className="absolute -top-4 -right-4 bg-green-500/10 w-24 h-24 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-green-500/20 p-3 rounded-xl border border-green-500/30 shadow-lg shadow-green-500/20">
              <Package className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Volume de Comissões</p>
              <h2 className="text-3xl font-black text-white mt-0.5">
                {globalStats.count}
              </h2>
            </div>
          </div>
          <div className="pt-4 border-t border-brand-white/5 flex items-center justify-between">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Vendas processadas</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-brand-dark/40 backdrop-blur-md border border-brand-white/10 p-6 rounded-2xl relative overflow-hidden group"
        >
          <div className="absolute -top-4 -right-4 bg-purple-500/10 w-24 h-24 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-purple-500/20 p-3 rounded-xl border border-purple-500/30 shadow-lg shadow-purple-500/20">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                {isCoprodutorRole ? "Produtos com Vendas" : "Parceiros Ativos"}
              </p>
              <h2 className="text-3xl font-black text-white mt-0.5">
                {selectedProductId === 'all' 
                  ? (isCoprodutorRole ? globalStats.uniqueProducts : globalStats.uniqueCoproducers) 
                  : (isCoprodutorRole ? (globalStats.count > 0 ? 1 : 0) : coproducerGains.length)}
              </h2>
            </div>
          </div>
          <div className="pt-4 border-t border-brand-white/5 flex items-center justify-between">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
              {isCoprodutorRole ? "Total de treinamentos vinculados" : (selectedProductId === 'all' ? "Cadastrados no sistema" : "Neste produto")}
            </span>
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-5 h-5 rounded-full bg-brand-dark border border-brand-white/10 flex items-center justify-center">
                  <User className="w-3 h-3 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Coproducers List Table */}
      <div className="bg-brand-dark/40 backdrop-blur-md border border-brand-white/5 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="p-6 border-b border-brand-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white flex items-center gap-3 text-xl tracking-tighter uppercase">
              Lista de Comissionamento
              <span className="text-[10px] bg-brand-blue/20 text-brand-blue px-3 py-1 rounded-full font-bold tracking-widest">
                {coproducerGains.length} PARCEIROS
              </span>
            </h3>
            <p className="text-gray-500 text-xs mt-1 font-medium italic">Valores calculados em tempo real com base no faturamento bruto.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-black/40 text-gray-500 text-[10px] uppercase tracking-[0.2em] font-black">
                <th className="px-8 py-5">Parceiro</th>
                <th className="px-8 py-5">E-mail de Cadastro</th>
                <th className="px-8 py-5 text-center">Configuração Split</th>
                <th className="px-8 py-5 text-center">Qtd. Vendas</th>
                <th className="px-8 py-5 text-right font-bold text-white">Total Ganho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-white/5">
              {coproducerGains.length > 0 ? (
                coproducerGains.map((gain, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={gain.id} 
                    className="hover:bg-brand-white/5 transition-all group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-brand-black border border-brand-white/10 flex items-center justify-center group-hover:border-brand-blue/50 transition-colors">
                          <User className="text-gray-500 group-hover:text-brand-blue" />
                        </div>
                        <div>
                          <p className="text-sm text-white font-black tracking-tight">{gain.name || 'Sem Nome'}</p>
                          <span className="text-[10px] text-gray-500 font-bold uppercase">ID: {gain.id.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-xs text-gray-400 font-bold font-mono">
                      {gain.email}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="bg-brand-blue/10 text-brand-blue text-[11px] px-3 py-1 rounded-md font-black border border-brand-blue/20">
                        {gain.percentage !== undefined ? `${gain.percentage}%` : 'Múltiplos'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center font-bold text-white text-sm">
                      {gain.salesCount}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="text-brand-blue font-black text-lg drop-shadow-[0_0_8px_rgba(45,124,255,0.4)]">
                        R$ {(gain.totalGained / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-40">
                      <Package className="w-12 h-12 text-gray-500" />
                      <p className="text-lg font-black text-gray-400 font-mono uppercase tracking-[0.2em]">
                        Nenhum coprodutor com vendas registradas para este filtro.
                      </p>
                      <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                        Tente selecionar outro produto ou verifique os splits cadastrados.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info */}
      <footer className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-brand-dark/20 rounded-2xl border border-brand-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-brand-blue animate-pulse shadow-[0_0_10px_#2D7CFF]"></div>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">Sincronizado com Pagar.me em Tempo Real</span>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="text-xs font-black text-brand-blue uppercase tracking-widest hover:underline transition-all"
        >
          Forçar Recarregamento de Dados
        </button>
      </footer>
    </div>
  );
};

export default CoproductionDashboard;
