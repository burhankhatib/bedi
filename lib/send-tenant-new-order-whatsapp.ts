/**
 * Business "new order" WhatsApp: same Meta template (`new_order`) for instant + 3‑minute reminder.
 * Retries alternate language codes, optional URL button, and 1 vs 2 body variables for template drift.
 */

import { sendWhatsAppTemplateMessage } from '@/lib/meta-whatsapp'
import {
  formatTenantNewOrderWhatsAppSummary,
  type TenantOrderWhatsAppInput,
} from '@/lib/whatsapp-tenant-order-summary'

export const TENANT_NEW_ORDER_TEMPLATE = 'new_order'

/** Template-approved language codes to try (first match wins). */
const LANGUAGE_TRIES = ['ar_EG', 'ar'] as const

/** WhatsApp body variables: stay under common Cloud API / template limits. */
const MAX_BUSINESS_NAME_CHARS = 280
const MAX_ORDER_SUMMARY_CHARS = 3400
const MAX_COMBINED_SINGLE_VAR_CHARS = 3400

export function buildNewOrderDynamicUrlSuffix(tenantSlug?: string | null): string {
  let s = (tenantSlug ?? '').trim()
  if (!s || s === 'undefined' || s === 'null') return 'orders'
  s = s.replace(/^\/+|\/+$/g, '')
  if (!s) return 'orders'
  const suffix = `${s}/orders`
  return suffix.length > 512 ? suffix.slice(0, 512) : suffix
}

/** Strip accidental quotes / whitespace from Sanity phone fields. */
export function cleanWhatsAppRecipientPhone(phone: string | undefined | null): string {
  return (phone ?? '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()
}

function sanitizeTemplateVariable(text: string, maxLen: number): string {
  const t = (text ?? '')
    .replace(/\0/g, '')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/\r\n/g, '\n')
  if (t.length <= maxLen) return t
  const cut = Math.max(0, maxLen - 60)
  return `${t.slice(0, cut)}\n\n⚠️ نص مختصر — افتح التطبيق للتفاصيل الكاملة.`
}

export type SendTenantNewOrderWhatsAppResult = {
  success: boolean
  error?: unknown
  /** Ordered list of attempts for diagnostics (e.g. `2vars+button+ar_EG:false`). */
  attempts: string[]
}

/**
 * Send `new_order` to the business owner with full order summary + optional Maps/Waze (from formatter).
 */
export async function sendTenantNewOrderWhatsApp(opts: {
  phone: string
  businessName: string
  orderSummaryInput: TenantOrderWhatsAppInput
  tenantSlug?: string | null
}): Promise<SendTenantNewOrderWhatsAppResult> {
  const attempts: string[] = []
  const phone = cleanWhatsAppRecipientPhone(opts.phone)
  if (!phone) {
    return { success: false, error: 'empty_phone', attempts }
  }

  const var1 = sanitizeTemplateVariable(opts.businessName || 'Business', MAX_BUSINESS_NAME_CHARS)
  const summaryRaw = formatTenantNewOrderWhatsAppSummary(opts.orderSummaryInput)
  const var2 = sanitizeTemplateVariable(summaryRaw, MAX_ORDER_SUMMARY_CHARS)
  const button = buildNewOrderDynamicUrlSuffix(opts.tenantSlug)

  let lastError: unknown = undefined

  const run = async (
    label: string,
    fn: () => ReturnType<typeof sendWhatsAppTemplateMessage>
  ): Promise<boolean> => {
    const r = await fn()
    attempts.push(`${label}:${r.success ? 'ok' : 'fail'}`)
    if (r.success) return true
    lastError = r.error
    return false
  }

  for (const lang of LANGUAGE_TRIES) {
    if (await run(`2vars+button+${lang}`, () => sendWhatsAppTemplateMessage(phone, TENANT_NEW_ORDER_TEMPLATE, [var1, var2], lang, button))) {
      return { success: true, attempts }
    }
    if (await run(`2vars+${lang}`, () => sendWhatsAppTemplateMessage(phone, TENANT_NEW_ORDER_TEMPLATE, [var1, var2], lang))) {
      return { success: true, attempts }
    }

    const combined = sanitizeTemplateVariable(`${var1}\n\n${var2}`, MAX_COMBINED_SINGLE_VAR_CHARS)
    if (await run(`1var+button+${lang}`, () => sendWhatsAppTemplateMessage(phone, TENANT_NEW_ORDER_TEMPLATE, [combined], lang, button))) {
      return { success: true, attempts }
    }
    if (await run(`1var+${lang}`, () => sendWhatsAppTemplateMessage(phone, TENANT_NEW_ORDER_TEMPLATE, [combined], lang))) {
      return { success: true, attempts }
    }
  }

  return { success: false, error: lastError, attempts }
}
