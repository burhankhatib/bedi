/**
 * Send one WhatsApp template test per type (Meta Cloud API).
 * Usage: npx tsx scripts/test-all-whatsapp-templates.ts +9725XXXXXXXXX
 * Requires: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN in .env.local
 */

import path from 'path'
import { config } from 'dotenv'

config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  const phone = process.argv[2]?.trim()
  if (!phone) {
    console.error('Usage: npx tsx scripts/test-all-whatsapp-templates.ts +9725XXXXXXXXX')
    process.exit(1)
  }

  const {
    sendWhatsAppAuthOTP,
    sendSubscriptionReminderWhatsApp,
    sendWhatsAppTemplateMessageWithLangFallback,
  } = await import('../lib/meta-whatsapp')
  const { WHATSAPP_TEMPLATE } = await import('../lib/whatsapp-meta-templates')
  const { TENANT_NEW_ORDER_TEMPLATE } = await import('../lib/send-tenant-new-order-whatsapp')
  const { formatTenantNewOrderWhatsAppSummary } = await import('../lib/whatsapp-tenant-order-summary')

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  console.log('Sending 5 template tests to', phone, '…\n')

  const run = async (label: string, fn: () => Promise<{ success: boolean; error?: unknown }>) => {
    const r = await fn()
    console.log(label, r.success ? '✅' : '❌', r.success ? '' : JSON.stringify(r.error).slice(0, 200))
    await sleep(500)
  }

  await run(`1. ${TENANT_NEW_ORDER_TEMPLATE}`, () =>
    sendWhatsAppTemplateMessageWithLangFallback(
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
  )

  const subscriptionTemplate =
    process.env.WHATSAPP_SUBSCRIPTION_REMINDER_TEMPLATE?.trim() || WHATSAPP_TEMPLATE.SUBSCRIPTION_REMINDER
  await run(`2. ${subscriptionTemplate}`, () =>
    sendSubscriptionReminderWhatsApp(phone, subscriptionTemplate, 7)
  )

  await run(`3. ${WHATSAPP_TEMPLATE.BROADCAST}`, () =>
    sendWhatsAppTemplateMessageWithLangFallback(phone, WHATSAPP_TEMPLATE.BROADCAST, [
      'Burhan',
      'This is a broadcast template test from Zonify admin (QA). هذه رسالة تجريبية.',
    ])
  )

  await run(`4. ${WHATSAPP_TEMPLATE.NEW_DELIVERY}`, () =>
    sendWhatsAppTemplateMessageWithLangFallback(phone, WHATSAPP_TEMPLATE.NEW_DELIVERY, [])
  )

  await run(`5. ${WHATSAPP_TEMPLATE.OTP}`, () => sendWhatsAppAuthOTP(phone, '123456'))

  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
