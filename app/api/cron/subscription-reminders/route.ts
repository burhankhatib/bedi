import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'
import { sendSubscriptionReminderWhatsApp } from '@/lib/meta-whatsapp'
import { WHATSAPP_TEMPLATE } from '@/lib/whatsapp-meta-templates'

export const dynamic = 'force-dynamic'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  // Optional: check cron secret to prevent unauthorized execution
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + SEVEN_DAYS_MS).toISOString()
  const nowIso = now.toISOString()
  const yesterdayIso = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString()

  // Find active tenants where subscription is expiring in <= 7 days, 
  // and we haven't reminded them in the last 20 hours.
  // Note: we also consider trials ending in <= 7 days by comparing businessCreatedAt + 30 days.
  
  // Sanity GROQ cannot easily do datetime math (e.g. businessCreatedAt + 30 days) on the fly for filtering.
  // So we fetch active tenants, calculate expiry locally, and filter.
  // We'll exclude tenants that are already past due, cancelled, or blocked.

  const writeClient = client.withConfig({ token, useCdn: false })

  try {
    const tenants = await writeClient.fetch(`
      *[_type == "tenant" && subscriptionStatus in ["active", "trial"] && blockedBySuperAdmin != true] {
        _id,
        name,
        "slug": slug.current,
        subscriptionExpiresAt,
        businessCreatedAt,
        createdAt,
        lastSubscriptionReminderAt,
        ownerPhone
      }
    `)

    let notificationsSent = 0
    const errors: string[] = []

    for (const tenant of tenants) {
      // Calculate effective expiry
      let expiryTime: number | null = null
      if (tenant.subscriptionExpiresAt) {
        expiryTime = new Date(tenant.subscriptionExpiresAt).getTime()
      } else {
        const createdDate = tenant.businessCreatedAt || tenant.createdAt
        if (createdDate) {
          expiryTime = new Date(createdDate).getTime() + 30 * 24 * 60 * 60 * 1000
        }
      }

      if (!expiryTime) continue

      const timeUntilExpiry = expiryTime - now.getTime()
      
      // If expired, skip (handled by other logic when they visit dashboard)
      if (timeUntilExpiry <= 0) continue

      // If within 7 days
      if (timeUntilExpiry <= SEVEN_DAYS_MS) {
        // Check if we reminded them recently
        if (
          tenant.lastSubscriptionReminderAt &&
          tenant.lastSubscriptionReminderAt > yesterdayIso
        ) {
          continue // Already reminded within 24h
        }

        const daysLeft = Math.max(1, Math.ceil(timeUntilExpiry / (24 * 60 * 60 * 1000)))
        
        try {
          // Send notification
          await sendTenantAndStaffPush(tenant._id, {
            title: `تذكير: اشتراكك ينتهي قريباً`,
            body: `تبقى ${daysLeft} يوم على انتهاء اشتراك متجرك. يرجى تجديد الاشتراك لتجنب إيقاف المتجر.`,
            url: `${process.env.NEXT_PUBLIC_APP_URL}/t/${tenant.slug}/manage/billing`,
            dir: 'rtl'
          })

          if (tenant.ownerPhone) {
            /** Meta body: `عدد الأيام … *{{1}}*` — {{1}} is the number of days only; language ar_EG. */
            const subscriptionTemplate =
              process.env.WHATSAPP_SUBSCRIPTION_REMINDER_TEMPLATE?.trim() ||
              WHATSAPP_TEMPLATE.SUBSCRIPTION_REMINDER
            const waResult = await sendSubscriptionReminderWhatsApp(
              tenant.ownerPhone,
              subscriptionTemplate,
              daysLeft
            )
            if (!waResult.success) {
              console.error(`Failed to send WhatsApp reminder to ${tenant.ownerPhone}:`, waResult.error)
            }
          }

          // Update last reminder
          await writeClient
            .patch(tenant._id)
            .set({ lastSubscriptionReminderAt: nowIso })
            .commit()
            
          notificationsSent++
        } catch (err: any) {
          console.error(`Failed to process reminder for tenant ${tenant._id}:`, err)
          errors.push(`Tenant ${tenant._id}: ${err.message}`)
        }
      }
    }

    return NextResponse.json({ ok: true, notificationsSent, errors })
  } catch (error: any) {
    console.error('Error in subscription-reminders cron:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
