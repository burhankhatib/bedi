/**
 * Server-only PayPal API helpers for one-time orders (Orders v2).
 * Uses PAYPAL_CLIENT_ID (or NEXT_PUBLIC_PAYPAL_CLIENT_ID), PAYPAL_CLIENT_SECRET,
 * and PAYPAL_SANDBOX=true for sandbox.
 * @see https://developer.paypal.com/docs/api/orders/v2/
 */

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim() ||
  ''
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET?.trim() || ''
const SANDBOX = process.env.PAYPAL_SANDBOX === 'true'
const BASE = SANDBOX ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

let cachedToken: { access_token: string; expires_at: number } | null = null

/** Get OAuth2 access token (cached until near expiry). */
export async function getPayPalAccessToken(): Promise<string> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required')
  }
  const now = Date.now()
  if (cachedToken && cachedToken.expires_at > now + 60_000) {
    return cachedToken.access_token
  }
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal token failed: ${res.status} ${err}`)
  }
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    access_token: json.access_token,
    expires_at: now + (json.expires_in ?? 32400) * 1000,
  }
  return cachedToken.access_token
}

export type CreateOrderParams = {
  planId: string
  amount: string
  currencyCode: string
  description?: string
  returnUrl: string
  cancelUrl: string
}

/**
 * Create a checkout order (intent CAPTURE). Returns order id and approve URL.
 */
export async function createPayPalOrder(params: CreateOrderParams): Promise<{ orderId: string; approveUrl: string }> {
  const token = await getPayPalAccessToken()
  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: params.currencyCode,
          value: params.amount,
        },
        description: params.description ?? undefined,
        custom_id: params.planId,
      },
    ],
    application_context: {
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
      brand_name: undefined,
    },
  }
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `order-${params.planId}-${Date.now()}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal create order failed: ${res.status} ${err}`)
  }
  const order = (await res.json()) as {
    id: string
    links?: Array<{ rel: string; href: string }>
  }
  const approve = order.links?.find((l) => l.rel === 'approve')
  if (!approve?.href) {
    throw new Error('PayPal create order did not return approve link')
  }
  return { orderId: order.id, approveUrl: approve.href }
}

/**
 * Capture a created order. Returns capture details; use custom_id from order to get planId.
 */
export async function capturePayPalOrder(orderId: string): Promise<{ customId?: string; status: string }> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-${orderId}-${Date.now()}`,
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal capture failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as {
    status?: string
    purchase_units?: Array<{ payments?: { captures?: Array<unknown> }; custom_id?: string }>
  }
  const customId = data.purchase_units?.[0]?.custom_id
  return { customId, status: data.status ?? 'COMPLETED' }
}

/** Get order details (to read custom_id if not returned by capture). */
export async function getPayPalOrder(orderId: string): Promise<{ custom_id?: string }> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal get order failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { purchase_units?: Array<{ custom_id?: string }> }
  const custom_id = data.purchase_units?.[0]?.custom_id
  return { custom_id }
}

export function isPayPalOrdersEnabled(): boolean {
  return Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET)
}

// --- Catalog Products & Subscriptions (v1) ---
// @see https://developer.paypal.com/docs/subscriptions/integrate/#create-product
// @see https://developer.paypal.com/docs/api/subscriptions/v1/

export type CreateCatalogProductParams = {
  name: string
  description: string
  type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE'
  category?: string
  image_url?: string
  home_url?: string
}

/**
 * Create a product via Catalog Products API (for use in subscription plans).
 */
export async function createPayPalCatalogProduct(
  params: CreateCatalogProductParams
): Promise<{ id: string }> {
  const token = await getPayPalAccessToken()
  const body = {
    name: params.name,
    description: params.description,
    type: params.type ?? 'SERVICE',
    category: params.category ?? 'SOFTWARE',
    image_url: params.image_url,
    home_url: params.home_url,
  }
  const res = await fetch(`${BASE}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `product-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal create product failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { id: string }
  return { id: data.id }
}

export type CreateBillingPlanParams = {
  product_id: string
  name: string
  description: string
  /** Price per billing cycle (e.g. "300") */
  amount: string
  currency_code: string
  /** Billing interval unit: MONTH, DAY, WEEK, YEAR */
  interval_unit?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
  interval_count?: number
  /** Total billing cycles; 0 = infinite */
  total_cycles?: number
}

/**
 * Create a subscription plan via Subscriptions API (v1 billing/plans).
 * Single REGULAR billing cycle, fixed price. Use the returned plan id with the JS SDK.
 */
export async function createPayPalBillingPlan(
  params: CreateBillingPlanParams
): Promise<{ id: string }> {
  const token = await getPayPalAccessToken()
  const interval_unit = params.interval_unit ?? 'MONTH'
  const interval_count = params.interval_count ?? 1
  const total_cycles = params.total_cycles ?? 0
  const body = {
    product_id: params.product_id,
    name: params.name,
    description: params.description,
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: { interval_unit, interval_count },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: total_cycles,
        pricing_scheme: {
          fixed_price: {
            value: params.amount,
            currency_code: params.currency_code,
          },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      payment_failure_threshold: 3,
    },
  }
  const res = await fetch(`${BASE}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal create plan failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { id: string }
  return { id: data.id }
}

/**
 * Cancel a PayPal recurring subscription. Subscriber keeps access until period end.
 * POST /v1/billing/subscriptions/{id}/cancel
 */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason?: string
): Promise<void> {
  const token = await getPayPalAccessToken()
  const res = await fetch(`${BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: reason ?? 'Customer requested cancellation' }),
  })
  if (!res.ok) {
    const raw = await res.text()
    let message: string
    try {
      const json = JSON.parse(raw) as { message?: string; name?: string; details?: Array<{ issue?: string; description?: string }> }
      const detail = json.details?.[0]
      message = detail?.description ?? json.message ?? json.name ?? raw
    } catch {
      message = raw || `HTTP ${res.status}`
    }
    if (res.status === 404) {
      throw new Error('Subscription not found or already cancelled.')
    }
    if (res.status === 410) {
      throw new Error('Subscription is already cancelled.')
    }
    throw new Error(message || `PayPal cancel failed (${res.status}).`)
  }
}
