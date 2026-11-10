import { roundMoney } from './util.js';

export type PricingPlan = { _id: unknown; name: string; prices: { category: string; amount: number }[]; joiningFee?: number };
export type PricingOffer = {
  _id: unknown;
  title: string;
  discountType: 'percent' | 'flat' | string;
  value: number;
  planIds?: unknown[];
  categories?: string[];
  code?: string;
  autoApply?: boolean;
  startsAt: Date | string;
  endsAt: Date | string;
  active?: boolean;
  priority?: number;
  maxRedemptions?: number;
  redemptions?: number;
  badgeText?: string;
};
export type TaxSettings = { label?: string; rate: number; inclusive: boolean };

export const isOfferLive = (o: PricingOffer, at = new Date()) =>
  o.active !== false &&
  new Date(o.startsAt) <= at &&
  new Date(o.endsAt) >= at &&
  !(o.maxRedemptions && (o.redemptions ?? 0) >= o.maxRedemptions);

export const offerApplies = (o: PricingOffer, planId: unknown, category: string) =>
  (!o.planIds?.length || o.planIds.some((p) => String(p) === String(planId))) &&
  (!o.categories?.length || o.categories.includes(category));

const discountOf = (o: PricingOffer, base: number) =>
  Math.min(base, o.discountType === 'percent' ? (base * Math.min(o.value, 100)) / 100 : o.value);

export function basePrice(plan: PricingPlan, category: string) {
  const exact = plan.prices.find((p) => p.category === category);
  const fallback = plan.prices.find((p) => p.category === 'standard') ?? plan.prices[0];
  const hit = exact ?? fallback;
  if (!hit) return null;
  return { amount: hit.amount, category: hit.category };
}

/**
 * The single pricing function used by BOTH the public website and billing,
 * so the price a visitor sees is exactly the price the front desk charges.
 */
export function quote(args: {
  plan: PricingPlan;
  category: string;
  offers: PricingOffer[];
  tax: TaxSettings;
  currency: string;
  code?: string;
  at?: Date;
  includeJoiningFee?: boolean;
}) {
  const { plan, offers, tax, currency, at = new Date() } = args;
  const bp = basePrice(plan, args.category);
  if (!bp) throw Object.assign(new Error(`Plan "${plan.name}" has no price configured`), { status: 400 });
  const code = args.code?.trim().toUpperCase();
  const joiningFee = args.includeJoiningFee ? plan.joiningFee ?? 0 : 0;
  const base = bp.amount;

  const candidates = offers.filter(
    (o) => isOfferLive(o, at) && offerApplies(o, plan._id, bp.category) && (code ? o.code === code || (o.autoApply && !o.code) : o.autoApply && !o.code)
  );
  let best: PricingOffer | null = null;
  let bestDiscount = 0;
  for (const o of candidates) {
    const d = discountOf(o, base);
    if (d > bestDiscount || (d === bestDiscount && best && (o.priority ?? 0) > (best.priority ?? 0))) {
      best = o;
      bestDiscount = d;
    }
  }
  const codeRejected = Boolean(code) && !(best && best.code === code);
  const discount = roundMoney(bestDiscount, currency);
  const net = roundMoney(base - discount + joiningFee, currency);

  let taxAmount: number;
  let total: number;
  let subtotal: number;
  if (tax.inclusive) {
    total = net;
    taxAmount = roundMoney(net - net / (1 + tax.rate / 100), currency);
    subtotal = roundMoney(base + joiningFee, currency);
  } else {
    taxAmount = roundMoney((net * tax.rate) / 100, currency);
    total = roundMoney(net + taxAmount, currency);
    subtotal = roundMoney(base + joiningFee, currency);
  }

  return {
    planId: String(plan._id),
    planName: plan.name,
    category: bp.category,
    currency,
    base,
    joiningFee,
    subtotal,
    discount,
    offer: best ? { id: String(best._id), title: best.title, code: best.code || '', badgeText: best.badgeText || '' } : null,
    codeRejected,
    taxLabel: tax.label ?? 'Tax',
    taxRate: tax.rate,
    taxInclusive: tax.inclusive,
    tax: taxAmount,
    total,
  };
}
