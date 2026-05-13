import React, { useEffect, useState } from 'react';
import { ShoppingCart, Copy, Check, Search, Tag, Info, X, DollarSign, CreditCard, QrCode, FileText } from 'lucide-react';
import { getProducts } from '../../services/productService';
import { TictoProduct } from '../../types/product';
import { useAuth } from '../../contexts/AuthContext';
import { calculateNetCommissions } from '../../utils/commissionUtils';
import { motion, AnimatePresence } from 'motion/react';

const SalesPage: React.FC = () => {
    const [products, setProducts] = useState<TictoProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<TictoProduct | null>(null);
    const { currentUser, userRole } = useAuth();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const allProducts = await getProducts();
                
                // 1. Filtro de Coprodutor: Admin e Seller veem tudo. Coprodutor vê apenas o que ele participa.
                let baseProducts = allProducts;
                if (userRole === 'COPRODUTOR' && currentUser) {
                    baseProducts = allProducts.filter(p => {
                        const userUid = currentUser.uid;
                        const userEmail = currentUser.email?.toLowerCase();
                        
                        const inTopLevel = (p.coproduction || []).some((cp: any) => 
                            (cp.coproducerId || cp.userId || cp.id || cp.uid) === userUid ||
                            (userEmail && (cp.coproducerEmail || cp.email)?.toLowerCase() === userEmail)
                        );

                        const inOffers = (p.offers || []).some((off: any) => 
                            (off.coproducers || off.coproduction || []).some((cp: any) => 
                                (cp.coproducerId || cp.userId || cp.id || cp.uid) === userUid ||
                                (userEmail && (cp.coproducerEmail || cp.email)?.toLowerCase() === userEmail)
                            )
                        );

                        return inTopLevel || inOffers;
                    });
                }

                // 2. Filtro de Afiliação: 
                // Mostramos apenas produtos com afiliação ativa ou campo affiliate_enabled TRUE.
                const finalProducts = baseProducts.filter(p => 
                    p.affiliate_enabled === true || p.offers?.some(o => o.isAffiliationEnabled && o.isActive)
                );

                setProducts(finalProducts);
            } catch (error) {
                console.error("Erro ao carregar catálogo de vendas:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const copyLink = (offerId: string) => {
        const origin = window.location.origin;
        const refLink = `${origin}/checkout/${offerId}?ref=${currentUser?.uid}`;
        navigator.clipboard.writeText(refLink);
        setCopiedId(offerId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div className="space-y-1">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Catálogo de Afiliados</h2>
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest pt-1">Selecione um produto para obter seus links e ver projeções de ganhos.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                        <input 
                            type="text" 
                            placeholder="BUSCAR PRODUTOS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:border-red-500 focus:outline-none w-64 uppercase font-bold"
                        />
                    </div>
                </div>
            </div>

            {/* Netflix Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="text-center py-24 bg-zinc-950 border border-dashed border-zinc-800 rounded-3xl mx-2">
                    <p className="text-zinc-600 font-black uppercase tracking-widest text-xs">Nenhum produto disponível para filiação no momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-2">
                    {filteredProducts.map((product) => (
                        <motion.div 
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.05 }}
                            onClick={() => setSelectedProduct(product)}
                            className="relative aspect-[474/1000] rounded-xl overflow-hidden cursor-pointer group shadow-2xl bg-zinc-900 border border-zinc-800/50 hover:border-zinc-700 transition-all"
                        >
                            {product.coverUrl ? (
                                <img 
                                    src={product.coverUrl} 
                                    alt={product.name} 
                                    className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                    <ShoppingCart size={40} className="text-zinc-800 mb-2" />
                                    <p className="text-[10px] font-black text-zinc-700 uppercase leading-tight">{product.name}</p>
                                </div>
                            )}
                            
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                            
                            {/* Info on Bottom */}
                            <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                <span className="text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 mb-1 inline-block">
                                    {product.type}
                                </span>
                                <h3 className="text-white text-xs font-black uppercase tracking-tight line-clamp-2 leading-tight drop-shadow-md">
                                    {product.name}
                                </h3>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Product Details Drawer/Modal */}
            <AnimatePresence>
                {selectedProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedProduct(null)}
                            className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm"
                        />
                        
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-zinc-950 border border-zinc-800 w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl relative flex flex-col md:flex-row"
                        >
                            <button 
                                onClick={() => setSelectedProduct(null)}
                                className="absolute top-6 right-6 z-10 bg-zinc-900 p-2 rounded-full text-zinc-500 hover:text-white transition-colors border border-zinc-800"
                            >
                                <X size={20} />
                            </button>

                            {/* Left Side: Poster & Basic Info */}
                            <div className="w-full md:w-80 bg-zinc-900/50 p-6 flex flex-col items-center shrink-0 border-r border-zinc-900">
                                <div className="w-full aspect-[474/1000] rounded-2xl overflow-hidden shadow-2xl border border-white/5 mb-6">
                                    {selectedProduct.coverUrl ? (
                                        <img src={selectedProduct.coverUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-800">
                                            <ShoppingCart size={60} />
                                        </div>
                                    )}
                                </div>
                                <div className="w-full space-y-4">
                                    <div>
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Status</p>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Disponível para Filiação</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Suporte ao Afiliado</p>
                                        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/50">
                                            <p className="text-[10px] text-zinc-400 leading-relaxed italic">&quot;Este produto possui material de apoio e canal exclusivo para afiliados no Telegram.&quot;</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Offers & Projections */}
                            <div className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar">
                                <div className="mb-8">
                                    <span className="text-xs font-black text-red-500 uppercase tracking-[0.3em] mb-2 block">{selectedProduct.type}</span>
                                    <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-tight mb-4">{selectedProduct.name}</h2>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-zinc-800">
                                            <Info size={14} className="text-zinc-500" />
                                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{selectedProduct.accessDays} Dias de Acesso</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                            <DollarSign size={14} className="text-emerald-500" />
                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Até {Math.max(...(selectedProduct.offers?.filter(o => o.isAffiliationEnabled).map(o => o.affiliateCommission) || [0]))}% de Comissão</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                                        <h4 className="text-sm font-black text-white uppercase tracking-widest">Ofertas & Meios de Pagamento</h4>
                                        <div className="flex items-center gap-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                                            <span className="flex items-center gap-1"><QrCode size={10} /> PIX</span>
                                            <span className="flex items-center gap-1"><CreditCard size={10} /> CARTÃO</span>
                                            <span className="flex items-center gap-1"><FileText size={10} /> BOLETO</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {selectedProduct.offers?.filter(o => o.isActive && o.isAffiliationEnabled).map(offer => {
                                            const netEarns = calculateNetCommissions(offer.price, offer.affiliateCommission || 0);
                                            
                                            return (
                                                <div key={offer.id} className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 hover:bg-zinc-900/60 transition-all group/offer">
                                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                                        <div className="space-y-4 flex-1">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                                                                    <Tag size={16} className="text-red-500" />
                                                                </div>
                                                                <div>
                                                                    <h5 className="text-sm font-black text-white uppercase tracking-tight">{offer.name}</h5>
                                                                    <p className="text-xs font-bold text-zinc-500">Comissão de {offer.affiliateCommission}% sobre o valor líquido</p>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50">
                                                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1 flex items-center justify-between">
                                                                        PIX <span className="text-[8px] text-zinc-700 italic">(-1.2% + R$ 0,40)</span>
                                                                    </p>
                                                                    <p className="text-base font-black text-white">R$ {parseFloat(netEarns.pix).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                                </div>
                                                                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50">
                                                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1 flex items-center justify-between">
                                                                        CARTÃO* <span className="text-[8px] text-zinc-700 italic">(-4.99% + R$ 0,40)</span>
                                                                    </p>
                                                                    <p className="text-base font-black text-white">R$ {parseFloat(netEarns.card).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                                </div>
                                                                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50">
                                                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1 flex items-center justify-between">
                                                                        BOLETO <span className="text-[8px] text-zinc-700 italic">(-R$ 3.49)</span>
                                                                    </p>
                                                                    <p className="text-base font-black text-white">R$ {parseFloat(netEarns.boleto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-center gap-3 shrink-0 lg:w-48">
                                                            <div className="text-center">
                                                                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Preço Final</p>
                                                                <p className="text-2xl font-black text-white tracking-tighter">R$ {offer.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                                <p className="text-[8px] text-zinc-700 italic mt-1 font-bold uppercase tracking-tighter">*Média estimada</p>
                                                            </div>
                                                            <button 
                                                                onClick={() => copyLink(offer.id)}
                                                                className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                                                    copiedId === offer.id 
                                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40' 
                                                                    : 'bg-white text-zinc-950 hover:bg-zinc-200 shadow-lg shadow-white/5'
                                                                }`}
                                                            >
                                                                {copiedId === offer.id ? (
                                                                    <>
                                                                        <Check size={16} /> COPIADO
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Copy size={16} /> COPIAR LINK
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SalesPage;
