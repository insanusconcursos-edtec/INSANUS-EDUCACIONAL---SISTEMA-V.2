export interface Coproducer {
  id: string;
  name: string;
  username?: string;
  email: string;
  document: string; // CPF or CNPJ
  pagarmeRecipientId?: string; // Pagar.me Recipient ID
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
