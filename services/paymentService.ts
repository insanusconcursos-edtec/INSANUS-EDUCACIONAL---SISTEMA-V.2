
export interface PagarmePaymentData {
  transaction_amount: number;
  card_hash?: string;
  description: string;
  installments: number;
  payment_method: string;
  payer: {
    email: string;
    document: string;
  };
  metadata: {
    courseId: string;
    offerId?: string;
    userName: string;
    userPhone?: string;
  };
}

export const createPagarmePayment = async (data: any) => {
  const response = await fetch('/api/payments/pagarme/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao processar pagamento');
  }

  return await response.json();
};
