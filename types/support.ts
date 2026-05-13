export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type ProductType = 'plano' | 'curso_online' | 'turma_presencial' | 'simulado' | 'evento_ao_vivo';

export interface SupportTicket {
  id: string;
  userId: string;
  userProfile: {
    name: string;
    email: string;
    phone?: string;
    photoUrl?: string;
  };
  productType: ProductType;
  productId: string;
  productName: string;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  lastMessageSnippet: string;
  unreadCountAdmin: number;
  unreadCountUser: number;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderRole: 'student' | 'admin' | 'collaborator';
  senderName: string;
  text: string;
  imageUrl?: string;
  createdAt: number;
}
