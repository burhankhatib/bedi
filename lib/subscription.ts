/**
 * Subscription plans and PayPal payment links.
 * Prices in ILS. Optional env per plan: PAYPAL_LINK_1M, PAYPAL_LINK_3M, PAYPAL_LINK_6M, PAYPAL_LINK_12M.
 * Fallback: PAYPAL_PAYMENT_LINK used for all (tenant must pay the shown amount).
 */

export type PlanId = '1m' | '3m' | '6m' | '12m'

export const SUBSCRIPTION_PLANS: Record<
  PlanId,
  { months: number; priceIls: number; labelEn: string; labelAr: string; perMonthIls: number }
> = {
  '1m': { months: 1, priceIls: 350, labelEn: '1 Month', labelAr: 'شهر واحد', perMonthIls: 350 },
  '3m': { months: 3, priceIls: 960, labelEn: '3 Months', labelAr: '٣ أشهر', perMonthIls: 320 },
  '6m': { months: 6, priceIls: 1800, labelEn: '6 Months', labelAr: '٦ أشهر', perMonthIls: 300 },
  '12m': { months: 12, priceIls: 3600, labelEn: '12 Months', labelAr: '١٢ شهراً', perMonthIls: 300 },
}

const PAYPAL_LINKS: Record<PlanId, string | undefined> = {
  '1m': process.env.PAYPAL_LINK_1M?.trim() || undefined,
  '3m': process.env.PAYPAL_LINK_3M?.trim() || undefined,
  '6m': process.env.PAYPAL_LINK_6M?.trim() || undefined,
  '12m': process.env.PAYPAL_LINK_12M?.trim() || undefined,
}

const DEFAULT_PAYPAL_LINK = process.env.PAYPAL_PAYMENT_LINK?.trim() || 'https://www.paypal.com/ncp/payment/TGL6PLWW5NRBY'

/** Get PayPal checkout URL for a plan. Uses plan-specific link if set, else default. */
export function getPayPalLinkForPlan(planId: PlanId): string {
  return PAYPAL_LINKS[planId] || DEFAULT_PAYPAL_LINK
}

/** Add months to a date (from subscriptionExpiresAt or now). Uses 30 days per month so remaining trial/subscription days are preserved (e.g. 2 days left + 1 month = 32 days total). */
export function addMonthsToDate(from: Date, months: number): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + months * 30)
  return d
}

/** Add days to a date (for consistent 30-day subscription periods). */
export function addDaysToDate(from: Date, days: number): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d
}
