/**
 * Bank of Palestine (BOP) Payments integration.
 * Uses BOP_PAYMENTS_API_KEY (pk_test_/pk_live_) and BOP_PAYMENTS_API_SECRET (sk_test_/sk_live_).
 *
 * Callback URL (customer redirect after payment):
 *   - Local: https://<ngrok-subdomain>.ngrok-free.app/api/bop/callback
 *   - Production: https://yourdomain.com/api/bop/callback
 *
 * Webhook URL (server-to-server payment notification):
 *   - Local: https://<ngrok-subdomain>.ngrok-free.app/api/bop/webhook
 *   - Production: https://yourdomain.com/api/bop/webhook
 */

const BOP_API_KEY = process.env.BOP_PAYMENTS_API_KEY?.trim() ?? ''
const BOP_API_SECRET = process.env.BOP_PAYMENTS_API_SECRET?.trim() ?? ''

export function isBOPConfigured(): boolean {
  return Boolean(BOP_API_KEY && BOP_API_SECRET)
}

export function getBOPApiKey(): string {
  return BOP_API_KEY
}

export function getBOPApiSecret(): string {
  return BOP_API_SECRET
}

/**
 * Parse internalReference to get tenant slug and plan ID.
 * Format: slug:planId (e.g. "my-store:1m")
 */
export function parseBOPInternalReference(ref: string): { slug: string; planId: string } | null {
  if (!ref || typeof ref !== 'string') return null
  const parts = ref.trim().split(':')
  if (parts.length < 2) return null
  const [slug, planId] = parts
  if (!slug || !planId) return null
  const validPlans = ['basic-monthly', 'basic-yearly', 'pro-monthly', 'pro-yearly', 'ultra-monthly', 'ultra-yearly']
  if (!validPlans.includes(planId.toLowerCase())) return null
  return { slug: slug.trim(), planId: planId.toLowerCase() }
}

/**
 * Build internalReference for BOP payment (for callback/webhook lookup).
 * Max 18 chars for bank reference; internalReference has no restriction.
 */
export function buildBOPInternalReference(slug: string, planId: string): string {
  return `${slug}:${planId}`
}
