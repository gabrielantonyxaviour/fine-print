import type { Settings } from '../settings.ts';

export type CardInput = {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
};

export type PaymentMethodResult = { id: string | null; last4: string };

// Card details go straight to Stripe, which returns a payment method we can
// charge. We keep the Stripe reference and the last four digits; the full card
// number never touches our storage.
export async function createPaymentMethod(
  settings: Settings,
  card: CardInput,
): Promise<PaymentMethodResult> {
  const body = new URLSearchParams({
    type: 'card',
    'card[number]': card.number,
    'card[exp_month]': String(card.expMonth),
    'card[exp_year]': String(card.expYear),
    'card[cvc]': card.cvc,
  });
  const res = await fetch('https://api.stripe.com/v1/payment_methods', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${settings.stripe.secretKey}`,
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Stripe responded ${res.status}`);

  const payload = (await res.json().catch(() => ({}))) as {
    id?: unknown;
    card?: { last4?: unknown };
  };
  const id = typeof payload.id === 'string' ? payload.id : null;
  const last4 =
    typeof payload.card?.last4 === 'string' ? payload.card.last4 : card.number.slice(-4);
  return { id, last4 };
}
