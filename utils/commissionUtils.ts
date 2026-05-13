export const calculateNetCommissions = (price: number, commissionPercent: number) => {
  // Pagar.me Cascade Rates
  // PIX: 1.2% + R$ 0.40
  // CARD: 4.99% + R$ 0.40 (Average)
  // BOLETO: Fixed R$ 3.49

  // Calculate net amount after gateway fees
  const pixNet = price - (price * 0.012 + 0.40);
  const cardNet = price - (price * 0.0499 + 0.40);
  const boletoNet = price > 3.49 ? price - 3.49 : 0;

  // Calculate commission based on net amount
  const calc = (netAmount: number) => ((netAmount * commissionPercent) / 100).toFixed(2);

  return {
    pix: calc(pixNet),
    card: calc(cardNet),
    boleto: calc(boletoNet)
  };
};
