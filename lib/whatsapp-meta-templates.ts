/**
 * Meta WhatsApp Cloud API — approved template names (single source of truth).
 * Keep in sync with WhatsApp Business Manager / Meta.
 *
 * - new_order_v2: business new-order alert (body vars + optional URL button) — see send-tenant-new-order-whatsapp
 * - subscription_reminder_v2: tenant renewal (cron) — body {{1}} = days remaining (number); ar_EG, Marketing
 * - broadcast_message: admin broadcast (first name + message body)
 * - new_delivery: offline/online drivers — delivery jobs (cron unaccepted-delivery-whatsapp)
 * - otp: phone verification (verify-phone request)
 */
export const WHATSAPP_TEMPLATE = {
  NEW_ORDER: 'new_order_v2',
  SUBSCRIPTION_REMINDER: 'subscription_reminder_v2',
  BROADCAST: 'broadcast_message',
  NEW_DELIVERY: 'new_delivery',
  OTP: 'otp',
} as const

/** Try in order until Meta accepts (template language must exist in Manager). */
export const WHATSAPP_TEMPLATE_LANGUAGE_FALLBACK = ['ar_EG', 'ar', 'en_US', 'en'] as const
