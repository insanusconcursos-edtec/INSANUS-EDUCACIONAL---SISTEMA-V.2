import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getProductByOfferId } from '../../services/productService';
import { TictoProduct, ProductOffer } from '../../types/product';
import { presentialEventService } from '../../services/presentialEventService';
import { PresentialEvent } from '../../types/presentialEvent';
import { SystemLogo } from '../../components/common/SystemLogo';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { createPagarmePayment } from '../../services/paymentService';
import { formatInTimeZone } from 'date-fns-tz';
import { Loader2, ShieldCheck, CreditCard, QrCode, Lock, Copy, Check, CheckCircle2, ArrowRight, ChevronDown, X, Timer, Users2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const INSTALLMENT_MULTIPLIERS: Record<number, number> = {
  1: 1.00000, 2: 1.04018, 3: 1.06027, 4: 1.08036,
  5: 1.10045, 6: 1.12054, 7: 1.14063, 8: 1.16072,
  9: 1.18081, 10: 1.20090, 11: 1.22100, 12: 1.24109
};

export default function StandaloneCheckout() {
  const { offerId } = useParams<{ offerId: string }>();
  const [searchParams] = useSearchParams();
  const refId = searchParams.get('ref');
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<TictoProduct | null>(null);
  const [offer, setOffer] = useState<ProductOffer | null>(null);
  const [event, setEvent] = useState<PresentialEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix' | 'ticket'>('credit_card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_url: string } | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes in seconds
  const [installments, setInstallments] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [friends, setFriends] = useState<{name: string, email: string, confirmEmail: string, cpf: string, phone: string}[]>([]);
  const [registrationsCount, setRegistrationsCount] = useState(0);
  const [lotCountdown, setLotCountdown] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null);
  const [billingAddress, setBillingAddress] = useState({
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [fetchingCep, setFetchingCep] = useState(false);
  const navigate = useNavigate();

  // Cálculo Dinâmico de Preço com base no Método de Pagamento e Quantidade de Pessoas
  const totalToPay = useMemo(() => {
    if (!offer) return 0;
    
    let basePrice = offer.price;
    const numPeople = 1 + friends.length;

    // Se houver desconto por pessoa, aplica o desconto no preço base se houver pelo menos um amigo
    if (offer.personDiscountEnabled && offer.personDiscountPercentage && friends.length > 0) {
      basePrice = basePrice * (1 - (offer.personDiscountPercentage / 100));
    }

    let finalPrice = basePrice * numPeople;

    if (paymentMethod === 'pix' && offer.pixDiscount && offer.pixDiscount > 0) {
      finalPrice = finalPrice - (finalPrice * (offer.pixDiscount / 100));
    } else if (paymentMethod === 'ticket' && offer.boletoDiscount && offer.boletoDiscount > 0) {
      finalPrice = finalPrice - (finalPrice * (offer.boletoDiscount / 100));
    }

    return finalPrice;
  }, [offer, paymentMethod, friends]);

  const remainingSpots = useMemo(() => {
    if (!offer || !offer.lotUrgencyEnabled || offer.lotUrgencyType !== 'quantity') return null;
    const totalLimit = offer.lotQuantityLimit || 0;
    const fictitious = offer.lotFictitiousSoldAmount || 0;
    const real = registrationsCount || 0;
    
    // Se o admin definiu vendas fictícias, usamos o maior entre real e fictício para calcular o que resta
    const sold = Math.max(real, fictitious);
    const remaining = totalLimit - sold;
    return remaining > 0 ? remaining : 0;
  }, [offer, registrationsCount]);

  const installmentsOptions = useMemo(() => {
    if (!offer) return [];
    const max = offer.maxInstallments || 12;
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [offer]);
  
  // Credit Card States
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  
  // Buyer Data Steps
  const [currentStep, setCurrentStep] = useState(1);
  const [buyerData, setBuyerData] = useState({
    name: '',
    email: currentUser?.email || '',
    emailConfirm: currentUser?.email || '',
    cpf: currentUser?.cpf || '',
    phone: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentUser?.email) {
      setBuyerData(prev => ({
        ...prev,
        email: currentUser.email || '',
        emailConfirm: currentUser.email || '',
        cpf: currentUser.cpf || '',
        name: currentUser.displayName || ''
      }));
    }
  }, [currentUser]);

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!buyerData.name.trim()) errors.name = 'Nome completo é obrigatório';
    if (!buyerData.email.trim()) errors.email = 'E-mail é obrigatório';
    if (buyerData.email !== buyerData.emailConfirm) errors.emailConfirm = 'Os e-mails não coincidem';
    
    const cleanCpf = (buyerData.cpf || "").replace(/\D/g, '');
    if (cleanCpf.length !== 11) errors.cpf = 'CPF inválido (11 dígitos)';
    
    const cleanPhone = buyerData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) errors.phone = 'WhatsApp inválido';
    
    // Validar amigos
    friends.forEach((f, i) => {
      if (!f.name.trim()) errors[`friend_name_${i}`] = 'Nome é obrigatório';
      if (!f.email.trim()) errors[`friend_email_${i}`] = 'E-mail é obrigatório';
      if (f.email !== f.confirmEmail) errors[`friend_confirm_email_${i}`] = 'E-mails não conferem';
      if (f.cpf.replace(/\D/g, '').length !== 11) errors[`friend_cpf_${i}`] = 'CPF inválido';
      const cleanPhone = f.phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) errors[`friend_phone_${i}`] = 'WhatsApp inválido';
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      toast.error("Por favor, preencha todos os campos corretamente.");
    }
  };

  const maskCpf = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const handleBillingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (name === 'zipCode') {
      finalValue = value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
      if (finalValue.replace(/\D/g, '').length === 8) {
        fetchAddress(finalValue.replace(/\D/g, ''));
      }
    }

    setBillingAddress(prev => ({ ...prev, [name]: finalValue }));
  };

  const fetchAddress = async (cep: string) => {
    setFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setBillingAddress(prev => ({
          ...prev,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setFetchingCep(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (pixData && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [pixData, timeLeft]);

  // Polling do status do pagamento (PIX)
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout;

    if (pixData && orderId) {
      pollingInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/payments/pagarme/status?orderId=${orderId}`);
          const data = await response.json();
          
          if (data.success && data.status === 'paid') {
            clearInterval(pollingInterval);
            toast.success("Pagamento confirmado! Redirecionando...");
            setTimeout(() => {
              navigate('/obrigado');
            }, 1500);
          }
        } catch (error) {
          console.error("Erro no polling de pagamento:", error);
        }
      }, 5000); // Polling a cada 5 segundos
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pixData, orderId, navigate]);

  useEffect(() => {
    if (offer?.lotUrgencyEnabled && offer?.lotUrgencyType === 'date' && offer?.lotDateDeadline) {
      const interval = setInterval(() => {
        const deadline = new Date(offer.lotDateDeadline).getTime();
        const now = new Date().getTime();
        const distance = deadline - now;

        if (distance < 0) {
          setLotCountdown(null);
          clearInterval(interval);
          return;
        }

        setLotCountdown({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [offer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    async function loadData() {
      if (!offerId) return;
      try {
        const result = await getProductByOfferId(offerId);
        if (result && result.offer.isActive) {
          setProduct(result.product);
          setOffer(result.offer);

          // Ajusta método de pagamento padrão se o atual não for permitido
          const allowed = result.offer.paymentMethods || { creditCard: true, pix: true, boleto: true };
          if (paymentMethod === 'credit_card' && !allowed.creditCard) {
            if (allowed.pix) setPaymentMethod('pix');
            else if (allowed.boleto) setPaymentMethod('ticket');
          } else if (paymentMethod === 'pix' && !allowed.pix) {
            if (allowed.creditCard) setPaymentMethod('credit_card');
            else if (allowed.boleto) setPaymentMethod('ticket');
          } else if (paymentMethod === 'ticket' && !allowed.boleto) {
            if (allowed.creditCard) setPaymentMethod('credit_card');
            else if (allowed.pix) setPaymentMethod('pix');
          }

          // If it's a presential event, load event details
          if (result.product.type === 'EVENTO_PRESENCIAL' && result.product.linkedResources?.presentialEvents?.[0]) {
            const eventId = result.product.linkedResources.presentialEvents[0];
            const eventData = await presentialEventService.getEventById(eventId);
            setEvent(eventData);

            if (result.offer.lotUrgencyEnabled && result.offer.lotUrgencyType === 'quantity') {
              try {
                const count = await presentialEventService.getRegistrationsCount(eventId);
                setRegistrationsCount(count);
              } catch (err) {
                console.error("Error fetching registrations count:", err);
              }
            }
          }
        } else {
          setError('Esta oferta não está mais disponível ou é inválida.');
        }
      } catch (err) {
        console.error(err);
        setError('Ocorreu um erro ao carregar os detalhes da oferta.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [offerId]);

  const handlePayment = async () => {
    if (!product || !offer) return;

    if (!buyerData.cpf || !buyerData.name || !buyerData.email) {
      toast.error('Por favor, preencha seus dados pessoais (Nome, E-mail e CPF) corretamente.');
      return;
    }

    if (paymentMethod === 'credit_card') {
      if (!cardNumber || !cardHolder || !cardMonth || !cardYear || !cardCVV) {
        toast.error('Por favor, preencha todos os campos do cartão.');
        return;
      }
      if (!billingAddress.zipCode || !billingAddress.street || !billingAddress.number || !billingAddress.city || !billingAddress.state) {
        toast.error('Por favor, preencha o endereço de cobrança completo.');
        return;
      }
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const paymentData = {
        transaction_amount: Number(totalToPay),
        description: `Compra de ${product.name} - ${offer.name} (${1 + friends.length} pessoas)`,
        payment_method: paymentMethod,
        affiliateId: refId || null,
        // Card data if credit_card
        ...(paymentMethod === 'credit_card' && {
          card_number: cardNumber.replace(/\s/g, ''),
          card_holder_name: cardHolder,
          card_expiration_month: cardMonth,
          card_expiration_year: cardYear.length === 2 ? `20${cardYear}` : cardYear,
          card_cvv: cardCVV,
          installments: installments,
          billingAddress: billingAddress,
        }),
        payer: {
          email: buyerData.email,
          document: (buyerData.cpf || "").replace(/\D/g, ''),
          name: buyerData.name
        },
        metadata: {
          courseId: product.id!,
          offerId: offer.id,
          userName: buyerData.name,
          userEmail: buyerData.email,
          userPhone: buyerData.phone,
          userCpf: (buyerData.cpf || "").replace(/\D/g, ''),
          isStandalone: "true",
          refId: refId || '',
          friends: JSON.stringify(friends)
        },
      };

      const result = await createPagarmePayment(paymentData);
      
      if (result.success) {
        if (paymentMethod === 'pix' && result.pix) {
          setPixData(result.pix);
          if (result.payment?.id) {
            setOrderId(result.payment.id);
          }
          toast.success("PIX gerado com sucesso! Pague para liberar seu acesso.");
        } else {
          toast.success("Pagamento aprovado com sucesso!");
          // Redireciona para a página de obrigado
          window.location.href = '/obrigado';
        }
      } else {
        setErrorMessage(result.message || 'Erro ao processar pagamento');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Erro ao processar pagamento';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Carregando seu checkout...</p>
      </div>
    );
  }

  if (error || !product || !offer) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="mb-6 flex justify-center">
             <SystemLogo />
          </div>
          <h2 className="text-xl font-black text-white uppercase mb-2">Ops!</h2>
          <p className="text-zinc-400 mb-6">{error || 'Não foi possível encontrar esta oferta.'}</p>
          <a 
            href="/" 
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-black px-8 py-3 rounded-xl transition-all uppercase text-sm tracking-widest"
          >
            Voltar para o Início
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-red-600/30">
      {/* Header Slim */}
      <header className="py-8 flex justify-center">
        <SystemLogo />
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-20 mt-4">
        {/* Urgency Alert Section */}
        <AnimatePresence>
          {offer.lotUrgencyEnabled && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              {offer.lotUrgencyType === 'quantity' && remainingSpots !== null && remainingSpots <= (offer.lotQuantityLimit || 100) * 0.3 && (
                <div className="bg-amber-500 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(245,158,11,0.3)] border border-amber-400/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white animate-pulse">
                      <Users2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-amber-950 uppercase tracking-tight leading-none mb-1">Garanta sua vaga agora!</h4>
                      <p className="text-xs font-bold text-amber-900/80">Restam apenas {remainingSpots} {remainingSpots === 1 ? 'vaga' : 'vagas'} para a virada de lote.</p>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="px-4 py-2 bg-amber-950/10 rounded-lg border border-amber-950/10">
                      <span className="text-[10px] font-black text-amber-950 uppercase tracking-widest">Senso de Urgência</span>
                    </div>
                  </div>
                </div>
              )}

              {offer.lotUrgencyType === 'date' && lotCountdown && (
                <div className="bg-red-600 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-[0_0_25px_rgba(220,38,38,0.4)] border border-red-500">
                  <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm border border-white/20">
                      <Timer size={28} className="animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white uppercase tracking-tighter leading-none mb-1">O lote vira em breve!</h4>
                      <p className="text-xs font-bold text-red-100/70 uppercase tracking-widest">Aproveite o preço atual antes da virada.</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {[
                      { label: 'Dias', value: lotCountdown.days },
                      { label: 'Hrs', value: lotCountdown.hours },
                      { label: 'Min', value: lotCountdown.minutes },
                      { label: 'Seg', value: lotCountdown.seconds }
                    ].map((item, idx) => (
                      <div key={idx} className="flex flex-col items-center bg-zinc-950/30 backdrop-blur-md rounded-xl p-3 min-w-[70px] border border-white/10">
                        <span className="text-2xl font-black text-white leading-none">{item.value.toString().padStart(2, '0')}</span>
                        <span className="text-[9px] font-black text-red-100/50 uppercase tracking-widest mt-1">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
          
          {/* LADO ESQUERDO: Formulário Multi-etapas / Tela PIX */}
          <div className="bg-[#121212] border border-zinc-800 rounded-3xl p-6 md:p-10 shadow-2xl order-2 lg:order-1">
            <AnimatePresence mode="wait">
              {pixData ? (
                <motion.div
                  key="pix-screen"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-8"
                >
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-4">
                      <QrCode size={32} />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-white">Quase lá!</h3>
                    <p className="text-zinc-500 text-sm">
                      Finalize o pagamento via PIX para liberar seu acesso imediatamente.
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-4 text-red-500 bg-red-500/10 py-2 px-4 rounded-full border border-red-500/20 w-fit mx-auto">
                      <Loader2 size={14} className="animate-spin" />
                      <p className="text-[10px] font-black uppercase tracking-widest leading-none">
                        Expira em: <span className="text-xs ml-1">{formatTime(timeLeft)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-6 p-6 bg-zinc-950 rounded-2xl border border-zinc-800">
                    <div className="bg-white p-2 rounded-xl">
                       <img src={pixData.qr_code_url} alt="QR Code PIX" className="w-48 h-48" />
                    </div>
                    
                    <div className="w-full space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Pix Copia e Cola</label>
                      <div className="relative group">
                        <input 
                          type="text" 
                          readOnly 
                          value={pixData.qr_code}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-12 py-4 text-xs text-zinc-400 font-mono focus:outline-none"
                        />
                        <button 
                          onClick={handleCopyPix}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <div className="mt-1 w-5 h-5 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center shrink-0">
                          <CheckCircle2 size={12} />
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          <strong className="text-zinc-200">Aprovação Instantânea:</strong> Seu curso será liberado assim que o banco confirmar o pagamento.
                        </p>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="mt-1 w-5 h-5 bg-zinc-800 text-zinc-500 rounded-full flex items-center justify-center shrink-0">
                          <ArrowRight size={12} />
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                           Você receberá um e-mail com os dados de acesso em <strong className="text-zinc-200">até 2 minutos</strong> após a confirmação.
                        </p>
                      </li>
                    </ul>
                  </div>

                  <button 
                    onClick={() => window.location.href = '/app/home'}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest text-xs"
                  >
                    Já paguei, ir para a plataforma
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-8">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${currentStep === 1 ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                        {currentStep === 1 ? '01' : <ShieldCheck size={16} />}
                      </div>
                      <div className="h-px w-4 bg-zinc-800" />
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${currentStep === 2 ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                        02
                      </div>
                    </div>
                    <div className="text-right">
                       <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-1 text-white">
                         {currentStep === 1 ? 'Dados Pessoais' : 'Pagamento'}
                       </h3>
                       <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Passo {currentStep} de 2</p>
                    </div>
                </div>

                {currentStep === 1 ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-1.5 pt-6">
                        <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nome Completo</label>
                        <input 
                          type="text"
                          className={`w-full bg-zinc-950 border ${formErrors.name ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700`}
                          placeholder="Como no seu documento"
                          value={buyerData.name}
                          onChange={(e) => setBuyerData({...buyerData, name: e.target.value})}
                        />
                        {formErrors.name && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.name}</p>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Seu melhor E-mail</label>
                          <input 
                            type="email"
                            className={`w-full bg-zinc-950 border ${formErrors.email ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700`}
                            placeholder="exemplo@email.com"
                            value={buyerData.email}
                            onChange={(e) => setBuyerData({...buyerData, email: e.target.value})}
                          />
                          {formErrors.email && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.email}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Confirme seu E-mail</label>
                          <input 
                            type="email"
                            className={`w-full bg-zinc-950 border ${formErrors.emailConfirm ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700`}
                            placeholder="Repita o e-mail"
                            value={buyerData.emailConfirm}
                            onChange={(e) => setBuyerData({...buyerData, emailConfirm: e.target.value})}
                          />
                          {formErrors.emailConfirm && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.emailConfirm}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">CPF</label>
                          <input 
                            type="text"
                            className={`w-full bg-zinc-950 border ${formErrors.cpf ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700`}
                            placeholder="000.000.000-00"
                            value={buyerData.cpf}
                            onChange={(e) => setBuyerData({...buyerData, cpf: maskCpf(e.target.value)})}
                          />
                          {formErrors.cpf && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.cpf}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">WhatsApp</label>
                          <input 
                            type="text"
                            className={`w-full bg-zinc-950 border ${formErrors.phone ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700`}
                            placeholder="(00) 00000-0000"
                            value={buyerData.phone}
                            onChange={(e) => setBuyerData({...buyerData, phone: maskPhone(e.target.value)})}
                          />
                          {formErrors.phone && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.phone}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Amigos (Pessoas Extras) - Apenas para Eventos Presenciais com Desconto por Pessoa Ativo */}
                    {product?.type === 'EVENTO_PRESENCIAL' && offer?.personDiscountEnabled && (
                      <div className="space-y-4 pt-6 mt-6 border-t border-zinc-800/50">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Pessoas Adicionais / Amigos</h4>
                          <button 
                            type="button"
                            onClick={() => setFriends([...friends, { name: '', email: '', confirmEmail: '', cpf: '', phone: '' }])}
                            className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline active:scale-95 transition-all"
                          >
                            + Adicionar Amigo
                          </button>
                        </div>
                        
                        <div className="space-y-4">
                          {friends.map((friend, index) => (
                            <motion.div 
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-6 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4 relative group"
                            >
                              <button 
                                onClick={() => setFriends(friends.filter((_, i) => i !== index))}
                                className="absolute top-4 right-4 text-zinc-600 hover:text-red-500 transition-colors"
                              >
                                <X size={16} />
                              </button>
                              
                              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Amigo #{index + 1}</p>
                              
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Nome Completo</label>
                                <input 
                                  type="text"
                                  className={`w-full bg-zinc-900 border ${formErrors[`friend_name_${index}`] ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3 text-white font-semibold text-sm focus:outline-none focus:border-red-500 transition-all`}
                                  placeholder="Nome do amigo"
                                  value={friend.name}
                                  onChange={(e) => {
                                    const newFriends = [...friends];
                                    newFriends[index].name = e.target.value;
                                    setFriends(newFriends);
                                  }}
                                />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">E-mail</label>
                                  <input 
                                    type="email"
                                    className={`w-full bg-zinc-900 border ${formErrors[`friend_email_${index}`] ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3 text-white font-semibold text-sm focus:outline-none focus:border-red-500 transition-all`}
                                    placeholder="E-mail do amigo"
                                    value={friend.email}
                                    onChange={(e) => {
                                      const newFriends = [...friends];
                                      newFriends[index].email = e.target.value;
                                      setFriends(newFriends);
                                    }}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Confirmar E-mail</label>
                                  <input 
                                    type="email"
                                    className={`w-full bg-zinc-900 border ${formErrors[`friend_confirm_email_${index}`] ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3 text-white font-semibold text-sm focus:outline-none focus:border-red-500 transition-all`}
                                    placeholder="Confirme o e-mail"
                                    value={friend.confirmEmail}
                                    onChange={(e) => {
                                      const newFriends = [...friends];
                                      newFriends[index].confirmEmail = e.target.value;
                                      setFriends(newFriends);
                                    }}
                                  />
                                  {formErrors[`friend_confirm_email_${index}`] && <p className="text-[9px] text-red-500 font-bold ml-1">{formErrors[`friend_confirm_email_${index}`]}</p>}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">CPF</label>
                                  <input 
                                    type="text"
                                    className={`w-full bg-zinc-900 border ${formErrors[`friend_cpf_${index}`] ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3 text-white font-semibold text-sm focus:outline-none focus:border-red-500 transition-all`}
                                    placeholder="000.000.000-00"
                                    value={friend.cpf}
                                    onChange={(e) => {
                                      const newFriends = [...friends];
                                      newFriends[index].cpf = maskCpf(e.target.value);
                                      setFriends(newFriends);
                                    }}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">WhatsApp / Celular</label>
                                  <input 
                                    type="text"
                                    className={`w-full bg-zinc-900 border ${formErrors[`friend_phone_${index}`] ? 'border-red-500' : 'border-zinc-800'} rounded-xl px-4 py-3 text-white font-semibold text-sm focus:outline-none focus:border-red-500 transition-all`}
                                    placeholder="(00) 00000-0000"
                                    value={friend.phone}
                                    onChange={(e) => {
                                      const newFriends = [...friends];
                                      newFriends[index].phone = maskPhone(e.target.value);
                                      setFriends(newFriends);
                                    }}
                                  />
                                  {formErrors[`friend_phone_${index}`] && <p className="text-[9px] text-red-500 font-bold ml-1">{formErrors[`friend_phone_${index}`]}</p>}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={handleNextStep}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-2 group uppercase tracking-widest text-sm shadow-lg shadow-red-600/10 active:scale-[0.98]"
                    >
                      Continuar para Pagamento
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 pt-6">
                    <button 
                      onClick={() => setCurrentStep(1)}
                      className="mb-2 text-[11px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1 hover:underline underline-offset-4 decoration-2"
                    >
                      ← Alterar dados pessoais
                    </button>

                    {/* Info de Evento Presencial */}
                    {product.type === 'EVENTO_PRESENCIAL' && event && (
                      <div className="bg-red-600/5 border border-red-600/20 rounded-2xl p-6 mb-4">
                        <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-4">Detalhes do Evento</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Data e Hora</span>
                            <p className="text-sm font-bold text-white">
                              {event.date ? formatInTimeZone(event.date instanceof Date ? event.date : (event.date as any).toDate(), 'UTC', 'dd/MM/yyyy') : 'A definir'} às {event.startTime}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Localização</span>
                            <p className="text-sm font-bold text-white">
                              {event.locationType === 'POLO_RI' ? 'Polo INSANUS CONCURSOS (Rio Branco/AC)' : 
                               event.locationType === 'POLO_PV' ? 'Polo GABARITO CONCURSOS (Porto Velho/RO)' : 
                               event.customLocation || 'Não definido'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-red-600/10">
                           <div className="flex gap-3">
                              <div className="mt-0.5 text-red-500 shrink-0">
                                <ShieldCheck size={16} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Garantia e Reembolso</p>
                                <p className="text-[11px] text-zinc-400 leading-relaxed font-medium italic">
                                  O reembolso e cancelamento ao evento somente é válido se realizado em até 48 horas antes da data da realização do evento. Após isso, o cliente perde o direito ao reembolso. O não comparecimento ao evento também não assegura o direito de reembolso ou crédito.
                                </p>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* Method Selector */}
                    <div className="grid grid-cols-3 gap-3">
                      {(!offer?.paymentMethods || offer.paymentMethods.creditCard) && (
                        <button
                          onClick={() => setPaymentMethod('credit_card')}
                          className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${paymentMethod === 'credit_card' ? 'bg-red-600/10 border-red-600 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                        >
                          <CreditCard size={20} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Cartão</span>
                        </button>
                      )}
                      {(!offer?.paymentMethods || offer.paymentMethods.pix) && (
                        <button
                          onClick={() => setPaymentMethod('pix')}
                          className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${paymentMethod === 'pix' ? 'bg-red-600/10 border-red-600 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                        >
                          {offer.pixDiscount && offer.pixDiscount > 0 && (
                            <div className="absolute -top-3 -right-2 bg-green-500 text-[#0a0a0a] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse z-10">
                              +{offer.pixDiscount}% OFF
                            </div>
                          )}
                          <QrCode size={20} />
                          <span className="text-[9px] font-black uppercase tracking-widest">PIX</span>
                        </button>
                      )}
                      {(!offer?.paymentMethods || offer.paymentMethods.boleto) && (
                        <button
                          onClick={() => setPaymentMethod('ticket')}
                          className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${paymentMethod === 'ticket' ? 'bg-red-600/10 border-red-600 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                        >
                          {offer.boletoDiscount && offer.boletoDiscount > 0 && (
                            <div className="absolute -top-3 -right-2 bg-green-500 text-[#0a0a0a] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse z-10">
                              +{offer.boletoDiscount}% OFF
                            </div>
                          )}
                          <ShieldCheck size={20} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Boleto</span>
                        </button>
                      )}
                    </div>

                    {errorMessage && (
                      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 mt-4">
                        <div className="mt-0.5 text-red-500">
                          <ShieldCheck size={16} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-black text-red-500 uppercase tracking-widest">Falha no Pagamento</p>
                          <p className="text-xs text-red-200/80 leading-relaxed font-medium">
                            {errorMessage}
                          </p>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'credit_card' ? (
                      <div className="space-y-4 pt-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Número do Cartão</label>
                          <div className="relative">
                            <input 
                              type="text"
                              value={cardNumber}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').substring(0, 19);
                                setCardNumber(val);
                              }}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700"
                              placeholder="0000 0000 0000 0000"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700">
                              <CreditCard size={18} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nome do Titular</label>
                          <input 
                            type="text"
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700 uppercase"
                            placeholder="NOME COMO NO CARTÃO"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Mês (MM)</label>
                            <input 
                              type="text"
                              value={cardMonth}
                              onChange={(e) => setCardMonth(e.target.value.replace(/\D/g, '').substring(0, 2))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all text-center"
                              placeholder="MM"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Ano (AA)</label>
                            <input 
                              type="text"
                              value={cardYear}
                              onChange={(e) => setCardYear(e.target.value.replace(/\D/g, '').substring(0, 4))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all text-center"
                              placeholder="AA"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">CVV</label>
                            <div className="relative">
                              <input 
                                type="text"
                                value={cardCVV}
                                onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, '').substring(0, 4))}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all text-center"
                                placeholder="000"
                              />
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700">
                                <Lock size={16} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Parcelas</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                              className={`w-full bg-[#1A1A1A] text-white border ${isDropdownOpen ? 'border-red-500 ring-1 ring-red-500' : 'border-neutral-700'} rounded-md p-3.5 flex items-center justify-between transition-all cursor-pointer`}
                            >
                              <span className="font-semibold">
                                {installments}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((totalToPay * INSTALLMENT_MULTIPLIERS[installments]) / installments)}
                              </span>
                              <ChevronDown size={18} className={`text-zinc-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                              {isDropdownOpen && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setIsDropdownOpen(false)} 
                                  />
                                  <motion.ul
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute z-50 w-full mt-2 bg-[#1A1A1A] border border-zinc-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto scrollbar-hide py-2"
                                  >
                                    {installmentsOptions.map((count) => {
                                      const totalWithInterest = totalToPay * INSTALLMENT_MULTIPLIERS[count];
                                      const installmentValue = totalWithInterest / count;
                                      return (
                                        <li
                                          key={count}
                                          onClick={() => {
                                            setInstallments(count);
                                            setIsDropdownOpen(false);
                                          }}
                                          className={`px-4 py-3 text-sm font-semibold cursor-pointer transition-colors ${
                                            installments === count ? 'bg-red-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                                          }`}
                                        >
                                          {count}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installmentValue)}
                                        </li>
                                      );
                                    })}
                                  </motion.ul>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Endereço de Cobrança */}
                        <div className="space-y-4 pt-6 border-t border-zinc-800/50">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Endereço de Cobrança (Obrigatório)</h3>
                            {fetchingCep && (
                              <div className="flex items-center gap-2">
                                <Loader2 size={12} className="animate-spin text-red-500" />
                                <span className="text-[9px] text-zinc-500 font-bold uppercase">Buscando...</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">CEP</label>
                              <input
                                type="text"
                                name="zipCode"
                                value={billingAddress.zipCode}
                                onChange={handleBillingChange}
                                placeholder="00000-000"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Número</label>
                              <input
                                type="text"
                                name="number"
                                value={billingAddress.number}
                                onChange={handleBillingChange}
                                placeholder="123"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700"
                                required
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2 space-y-1.5">
                              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Rua / Logradouro</label>
                              <input
                                type="text"
                                name="street"
                                value={billingAddress.street}
                                onChange={handleBillingChange}
                                placeholder="Nome da Rua"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700 disabled:opacity-50"
                                required
                                readOnly={!!billingAddress.street && fetchingCep === false && billingAddress.zipCode.length === 9}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Comp.</label>
                              <input
                                type="text"
                                name="complement"
                                value={billingAddress.complement}
                                onChange={handleBillingChange}
                                placeholder="Apto/Bl"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Bairro</label>
                              <input
                                type="text"
                                name="neighborhood"
                                value={billingAddress.neighborhood}
                                onChange={handleBillingChange}
                                placeholder="Bairro"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700 disabled:opacity-50"
                                required
                                readOnly={!!billingAddress.neighborhood && fetchingCep === false && billingAddress.zipCode.length === 9}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-2 space-y-1.5">
                                <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Cidade</label>
                                <input
                                  type="text"
                                  name="city"
                                  value={billingAddress.city}
                                  onChange={handleBillingChange}
                                  placeholder="Cidade"
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all placeholder:text-zinc-700 disabled:opacity-50"
                                  required
                                  readOnly={!!billingAddress.city && fetchingCep === false && billingAddress.zipCode.length === 9}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">UF</label>
                                <input
                                  type="text"
                                  name="state"
                                  value={billingAddress.state}
                                  onChange={handleBillingChange}
                                  placeholder="SP"
                                  maxLength={2}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-3.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 transition-all text-center uppercase disabled:opacity-50"
                                  required
                                  readOnly={!!billingAddress.state && fetchingCep === false && billingAddress.zipCode.length === 9}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={handlePayment}
                          disabled={isProcessing}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-2 group uppercase tracking-widest text-sm shadow-lg shadow-red-600/20 active:scale-[0.98] mt-4"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Processando...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={18} />
                              <span>Pagar {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalToPay)}</span>
                            </>
                          )}
                        </button>
                        <p className="text-[9px] text-zinc-500 text-center uppercase font-bold tracking-widest mt-2">
                           Pagamento processado com segurança via Pagar.me
                        </p>
                      </div>
                    ) : (
                      <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-2xl text-center space-y-4 mt-4">
                        <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center text-red-500 mx-auto">
                          <ShieldCheck size={32} />
                        </div>
                        <div>
                          <h4 className="text-white font-black uppercase tracking-tighter">
                            {paymentMethod === 'pix' ? 'Pagamento via PIX' : 'Pagamento via Boleto'}
                          </h4>
                          <p className="text-zinc-500 text-xs mt-2">
                            {paymentMethod === 'pix' 
                              ? 'Gere o código copia e cola para pagar agora.' 
                              : 'O boleto será enviado para o seu e-mail após a geração.'}
                          </p>
                        </div>
                        <button 
                          onClick={handlePayment}
                          disabled={isProcessing}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest text-sm disabled:opacity-50"
                        >
                          {isProcessing ? 'Processando...' : `Gerar ${paymentMethod === 'pix' ? 'PIX' : 'Boleto'}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* LADO DIREITO: Resumo do Pedido */}
          <aside className="space-y-6 order-1 lg:order-2">
             <div className="bg-red-600/10 border border-red-600/20 p-4 rounded-2xl flex gap-3">
               <ShieldCheck size={18} className="text-red-500 shrink-0" />
               <p className="text-[10px] text-zinc-300 font-medium leading-relaxed">
                 <span className="font-black text-red-500 uppercase block mb-1 tracking-widest">Garantia e Reembolso</span>
                 O reembolso ao evento somente é válido se realizado em até 48 horas antes da data da realização. O não comparecimento não assegura reembolso.
               </p>
             </div>
             <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl sticky top-8">
                <div className="aspect-video relative group overflow-hidden border-b border-zinc-800">
                   <img 
                     src={product.checkoutCoverUrl || product.coverUrl} 
                     alt={product.name} 
                     className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                   <div className="absolute bottom-4 left-4 right-4">
                      <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest mb-2 inline-block shadow-lg shadow-red-600/20">Produto Selecionado</span>
                      <h2 className="text-lg font-black text-white leading-tight uppercase tracking-tighter">{product.name}</h2>
                   </div>
                </div>

                <div className="p-6 space-y-6">
                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                         <span>Oferta Selecionada</span>
                         <span className="text-white">{offer.name}</span>
                      </div>
                      {offer.originalPrice && offer.originalPrice > offer.price && (
                        <div className="flex justify-between items-center pt-2">
                           <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Valor Original</span>
                           <span className="text-red-500 line-through text-lg font-semibold decoration-2">
                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.originalPrice)}
                           </span>
                        </div>
                      )}
                      <div className="h-px bg-zinc-800/50" />
                      
                      {(() => {
                        const discountPercentage = offer.originalPrice && offer.originalPrice > offer.price 
                          ? Math.round(((offer.originalPrice - offer.price) / (offer.originalPrice)) * 100) 
                          : 0;

                        const methodDiscount = paymentMethod === 'pix' && offer.pixDiscount && offer.pixDiscount > 0
                          ? { label: 'Desconto PIX Aplicado', value: offer.pixDiscount }
                          : paymentMethod === 'ticket' && offer.boletoDiscount && offer.boletoDiscount > 0
                          ? { label: 'Desconto Boleto Aplicado', value: offer.boletoDiscount }
                          : null;
                        
                        return (
                          <div className="flex justify-between items-end">
                            <div className="space-y-1 w-full">
                               {methodDiscount && (
                                 <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5 flex items-center justify-between mb-2">
                                   <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{methodDiscount.label}</span>
                                   <span className="text-[10px] text-emerald-500 font-mono font-bold">-{methodDiscount.value}%</span>
                                 </div>
                               )}
                               <div className="flex items-center gap-2">
                                 <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Total com Desconto</p>
                                 {discountPercentage > 0 && (
                                   <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[9px] font-black animate-pulse">
                                     {discountPercentage}% OFF
                                   </span>
                                 )}
                               </div>
                               <p className="text-3xl font-black text-white tracking-tighter">
                                 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalToPay)}
                               </p>
                            </div>
                          </div>
                        );
                      })()}
                   </div>

                   <div className="pt-6 border-t border-zinc-800 space-y-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500">
                           <ShieldCheck size={16} />
                         </div>
                         <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Compra 100% Protegida</p>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500">
                           <CreditCard size={16} />
                         </div>
                         <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Liberação Imediata</p>
                      </div>
                   </div>
                </div>
             </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
