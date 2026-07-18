export type ProductType = 'COMBO' | 'PLANO' | 'TURMA_ONLINE' | 'CURSO_ISOLADO' | 'SIMULADO' | 'EVENTO' | 'EVENTO_PRESENCIAL';

export interface LinkedResources {
  plans: string[];
  onlineCourses: string[];
  presentialClasses: string[];
  simulated: string[];
  liveEvents: string[];
  presentialEvents: string[];
}

export interface ProductOffer {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
  isActive: boolean;
  isAffiliationEnabled?: boolean; // Novo: Habilita afiliações por oferta
  affiliateCommission?: number; // Novo: Porcentagem de comissão por oferta
  originalPrice?: number; // Novo: Preço de ancoragem
  pixDiscount?: number; // Desconto para PIX (%)
  boletoDiscount?: number; // Desconto para Boleto (%)
  enrollmentFee?: number; // Taxa de matrícula
  isEnrollmentFeeExempt?: boolean; // Isenção da taxa de matrícula
  lotPrices?: Record<string, number>; // Mapping lotId to price
  personDiscountEnabled?: boolean; // Habilita desconto por pessoa extra
  personDiscountPercentage?: number; // Porcentagem de desconto por pessoa (%)
  paymentMethods?: {
    creditCard: boolean;
    pix: boolean;
    boleto: boolean;
  };
  maxInstallments?: number; // Máximo de parcelas (1-12)
  lotUrgencyEnabled?: boolean; // Habilita senso de urgência por lote
  lotUrgencyType?: 'quantity' | 'date'; // Tipo de urgência: por vagas ou por data
  lotQuantityLimit?: number; // Quantidade total de vagas no lote
  lotFictitiousSoldAmount?: number; // Quantidade fictícia de vagas vendidas
  lotDateDeadline?: string; // Data limite para virada de lote
}

export interface ProductSplit {
  id: string;
  productId: string;
  coproducerId: string;
  coproducerName: string;
  coproducerEmail: string;
  percentage: number;
  pagarmeRecipientId: string;
}

export interface Product {
  id?: string;
  name: string;
  price?: number; // Tornou-se opcional em favor das Offers
  gatewayId: string;
  type: ProductType;
  accessDays: number;
  coverUrl?: string;
  checkoutCoverUrl?: string;
  linkedResources: LinkedResources;
  offers?: ProductOffer[]; // Novo: Sistema de múltiplas ofertas
  coproduction?: ProductSplit[]; // Novo: Sistema de coprodução/split
  affiliate_enabled?: boolean; // Novo: Habilita afiliação no nível do produto
  liveEventIds?: string[]; // IDs dos eventos vinculados diretamente
  createdAt?: any;
  updatedAt?: any;
}
