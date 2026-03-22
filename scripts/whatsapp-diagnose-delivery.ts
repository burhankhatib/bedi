/**
 * OTP (auth) vs subscription_reminder_v2 (same phone). If only OTP arrives, check template category
 * in Meta (e.g. marketing opt-in) and Message statistics.
 *
 * Usage: npx tsx scripts/whatsapp-diagnose-delivery.ts "+9725xxxxxxx"
 */

import path from 'path'
import { config } from 'dotenv'

config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  const phone = process.argv[2]?.trim()
  if (!phone) {
    console.error('Usage: npx tsx scripts/whatsapp-diagnose-delivery.ts "+9725xxxxxxxx"')
    console.error('Use the exact WhatsApp number (with country code) you use on your phone.')
    process.exit(1)
  }

  const { sendWhatsAppAuthOTP, sendSubscriptionReminderWhatsApp } = await import('../lib/meta-whatsapp')
  const { WHATSAPP_TEMPLATE } = await import('../lib/whatsapp-meta-templates')

  console.log('\n--- 1) OTP template (otp) — short code 111222 ---')
  const otp = await sendWhatsAppAuthOTP(phone, '111222')
  console.log(otp.success ? '✅ Meta accepted' : '❌ Failed', otp.success ? `wamid=${otp.messageId || 'n/a'}` : JSON.stringify(otp.error).slice(0, 400))

  await new Promise((r) => setTimeout(r, 1500))

  console.log('\n--- 2) subscription_reminder_v2 — {{1}} = 5 days ---')
  const sub = await sendSubscriptionReminderWhatsApp(phone, WHATSAPP_TEMPLATE.SUBSCRIPTION_REMINDER, 5)
  console.log(sub.success ? '✅ Meta accepted' : '❌ Failed', sub.success ? `wamid=${sub.messageId || 'n/a'}` : JSON.stringify(sub.error).slice(0, 400))

  console.log('\n--- Next steps ---')
  console.log('• OTP = authentication; subscription = often marketing/utility — different delivery rules in Meta.')
  console.log('• Host logs: [WhatsApp Webhook] OUTBOUND FAILED for delivery errors.')
  console.log('• Meta: Message statistics; confirm marketing messages allowed for this user.\n')
}

main().catch(console.error)
