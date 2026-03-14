/**
 * Subscription plans: Basic, Pro, Ultra.
 * Billing periods: monthly, yearly (11 months paid, 1 free).
 * Prices in ILS.
 */

export type PlanTier = 'basic' | 'pro' | 'ultra'

export type PlanId =
  | 'basic-monthly'
  | 'basic-yearly'
  | 'pro-monthly'
  | 'pro-yearly'
  | 'ultra-monthly'
  | 'ultra-yearly'

export const SUBSCRIPTION_PLANS: Record<
  PlanId,
  {
    tier: PlanTier
    months: number
    priceIls: number
    labelEn: string
    labelAr: string
    perMonthIls: number
    productLimit: number | null
    hasTablesAndStaff: boolean
  }
> = {
  'basic-monthly': {
    tier: 'basic',
    months: 1,
    priceIls: 350,
    labelEn: 'Basic — Monthly',
    labelAr: 'باسيك — شهري',
    perMonthIls: 350,
    productLimit: 30,
    hasTablesAndStaff: false,
  },
  'basic-yearly': {
    tier: 'basic',
    months: 12,
    priceIls: 3850,
    labelEn: 'Basic — Yearly',
    labelAr: 'باسيك — سنوي',
    perMonthIls: 321,
    productLimit: 30,
    hasTablesAndStaff: false,
  },
  'pro-monthly': {
    tier: 'pro',
    months: 1,
    priceIls: 500,
    labelEn: 'Pro — Monthly',
    labelAr: 'برو — شهري',
    perMonthIls: 500,
    productLimit: 50,
    hasTablesAndStaff: true,
  },
  'pro-yearly': {
    tier: 'pro',
    months: 12,
    priceIls: 5500,
    labelEn: 'Pro — Yearly',
    labelAr: 'برو — سنوي',
    perMonthIls: 458,
    productLimit: 50,
    hasTablesAndStaff: true,
  },
  'ultra-monthly': {
    tier: 'ultra',
    months: 1,
    priceIls: 1000,
    labelEn: 'Ultra — Monthly',
    labelAr: 'ألترا — شهري',
    perMonthIls: 1000,
    productLimit: null,
    hasTablesAndStaff: true,
  },
  'ultra-yearly': {
    tier: 'ultra',
    months: 12,
    priceIls: 11000,
    labelEn: 'Ultra — Yearly',
    labelAr: 'ألترا — سنوي',
    perMonthIls: 917,
    productLimit: null,
    hasTablesAndStaff: true,
  },
}

/** Plan IDs for display (BOP billing section). */
export const BILLING_PLAN_IDS: PlanId[] = [
  'basic-monthly',
  'basic-yearly',
  'pro-monthly',
  'pro-yearly',
  'ultra-monthly',
  'ultra-yearly',
]

/** Get product limit for a plan tier. null = unlimited. */
export function getProductLimit(tier: PlanTier): number | null {
  switch (tier) {
    case 'basic':
      return 30
    case 'pro':
      return 50
    case 'ultra':
      return null
    default:
      return 30
  }
}

/** Whether Tables & Staff are available for this tier. */
export function hasTablesAndStaff(tier: PlanTier): boolean {
  return tier === 'pro' || tier === 'ultra'
}

/** Effective plan tier for a tenant. Trial = ultra; legacy tenants without subscriptionPlan default to ultra. */
export function getEffectivePlanTier(tenant: {
  subscriptionPlan?: 'basic' | 'pro' | 'ultra' | null
  subscriptionStatus?: string
}): PlanTier {
  if (tenant.subscriptionPlan) return tenant.subscriptionPlan
  if (tenant.subscriptionStatus === 'trial' || !tenant.subscriptionStatus) return 'ultra'
  return 'basic'
}

/** Add months to a date (from subscriptionExpiresAt or now). Uses 30 days per month. */
export function addMonthsToDate(from: Date, months: number): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + months * 30)
  return d
}

/** Add days to a date. */
export function addDaysToDate(from: Date, days: number): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d
}
