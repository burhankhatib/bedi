import path from 'path'
import { config } from 'dotenv'
config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  const phone = process.argv[2]?.trim() || '+972546708508'
  const { sendSubscriptionReminderWhatsApp } = await import('../lib/meta-whatsapp')
  const { WHATSAPP_TEMPLATE } = await import('../lib/whatsapp-meta-templates')
  const name = WHATSAPP_TEMPLATE.SUBSCRIPTION_REMINDER
  console.log('Template:', name, '(ar_EG) {{1}}=7, phone:', phone)
  console.log('(Use your WhatsApp number in E.164, e.g. +9725xxxxxxx)\n')
  const r = await sendSubscriptionReminderWhatsApp(phone, name, 7)
  if (r.success) {
    console.log('OK — Meta accepted. wamid:', r.messageId || '(missing — check Cloud API logs)')
    console.log('If you still see nothing on the phone: confirm this number is your WhatsApp; check Meta > WhatsApp > Message statistics.')
  } else {
    console.log('FAIL', JSON.stringify(r.error).slice(0, 800))
  }
}

main().catch(console.error)
