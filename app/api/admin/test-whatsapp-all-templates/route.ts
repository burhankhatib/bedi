import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import {
  sendWhatsAppAuthOTP,
  sendSubscriptionReminderWhatsApp,
  sendWhatsAppTemplateMessageWithLangFallback,
} from '@/lib/meta-whatsapp'
import { WHATSAPP_TEMPLATE } from '@/lib/whatsapp-meta-templates'
import { TENANT_NEW_ORDER_TEMPLATE } from '@/lib/send-tenant-new-order-whatsapp'
import { formatTenantNewOrderWhatsAppSummary } from '@/lib/whatsapp-tenant-order-summary'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type StepResult = { template: string; ok: boolean; error?: unknown }

/**
 * Super-admin only: send one Meta template test per type (same payloads as production).
 * POST body: { phone: string } — E.164 or local digits (normalized by Meta client).
 */
export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let phone = ''
  try {
    const body = await req.json()
    phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!phone) {
    return NextResponse.json({ error: 'phone is required (E.164, e.g. +9725XXXXXXXX)' }, { status: 400 })
  }

  const results: StepResult[] = []

  const push = (template: string, ok: boolean, error?: unknown) => {
    results.push({ template, ok, ...(error !== undefined && !ok ? { error } : {}) })
  }

  // 1) new_order_v2 — same shape as business notifier
  {
    const r = await sendWhatsAppTemplateMessageWithLangFallback(
      phone,
      TENANT_NEW_ORDER_TEMPLATE,
      [
        'Test Store (Zonify QA)',
        formatTenantNewOrderWhatsAppSummary({
          currency: 'ILS',
          items: [
            { quantity: 1, productName: 'Test item', productNameAr: 'صنف تجريبي', total: 39 },
            { quantity: 2, productName: 'Second line', productNameAr: 'سطر ثانٍ', total: 20 },
          ],
          totalAmount: 59,
          customerName: 'Burhan (QA)',
          customerPhone: '+972500000000',
          orderType: 'delivery',
          deliveryAddress: 'Test address · QA',
          deliveryLat: 31.7683,
          deliveryLng: 35.2137,
        }),
      ],
      'demo-tenant/orders'
    )
    push(TENANT_NEW_ORDER_TEMPLATE, r.success, r.error)
  }
  await sleep(400)

  // 2) subscription_reminder_v2 — {{1}} = days only; ar_EG (Arabic Egypt)
  {
    const subscriptionTemplate =
      process.env.WHATSAPP_SUBSCRIPTION_REMINDER_TEMPLATE?.trim() ||
      WHATSAPP_TEMPLATE.SUBSCRIPTION_REMINDER
    const r = await sendSubscriptionReminderWhatsApp(phone, subscriptionTemplate, 7)
    push(subscriptionTemplate, r.success, r.error)
  }
  await sleep(400)

  // 3) broadcast_message
  {
    const r = await sendWhatsAppTemplateMessageWithLangFallback(phone, WHATSAPP_TEMPLATE.BROADCAST, [
      'Burhan',
      'This is a broadcast template test from Zonify admin (QA). هذه رسالة تجريبية.',
    ])
    push(WHATSAPP_TEMPLATE.BROADCAST, r.success, r.error)
  }
  await sleep(400)

  // 4) new_delivery
  {
    const r = await sendWhatsAppTemplateMessageWithLangFallback(phone, WHATSAPP_TEMPLATE.NEW_DELIVERY, [])
    push(WHATSAPP_TEMPLATE.NEW_DELIVERY, r.success, r.error)
  }
  await sleep(400)

  // 5) otp — numeric test code (not tied to verify-phone DB)
  {
    const r = await sendWhatsAppAuthOTP(phone, '123456')
    push(WHATSAPP_TEMPLATE.OTP, r.success, r.error)
  }

  const allOk = results.every((x) => x.ok)
  return NextResponse.json({
    ok: allOk,
    phone: phone.replace(/\d(?=\d{4})/g, '•'),
    results,
  })
}
