import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendWhatsAppTemplateMessage } from '@/lib/meta-whatsapp'

export const dynamic = 'force-dynamic'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // Try to read secret from URL parameter as a fallback (for cron-job.org testing)
  const url = new URL(req.url)
  const secretParam = url.searchParams.get('secret')
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && secretParam !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  // Find orders that are 'new', haven't been notified yet.
  // We check for two conditions to trigger the 3-minute warning:
  // 1. Regular orders: created between 3 minutes and 2 hours ago.
  // 2. Scheduled orders (which revert to 'new' when their notification time arrives):
  //    notifyAt is between 3 minutes and 2 hours ago.
  const now = Date.now()
  const cutoff3m = new Date(now - 3 * 60 * 1000).toISOString()
  const cutoff2h = new Date(now - 2 * 60 * 60 * 1000).toISOString()

  try {
    const unacceptedOrders = await writeClient.fetch<{
      _id: string
      tenantPhone?: string
      tenantName?: string
      tenantNameAr?: string
      tenantSlug?: string
    }[]>(
      `*[
        _type == "order" &&
        status == "new" &&
        !defined(businessWhatsappNotifiedAt) &&
        (
          (!defined(scheduledFor) && createdAt <= $cutoff3m && createdAt >= $cutoff2h) ||
          (defined(scheduledFor) && defined(notifyAt) && notifyAt <= $cutoff3m && notifyAt >= $cutoff2h)
        )
      ]{
        _id,
        "tenantPhone": site->ownerPhone,
        "tenantName": site->name,
        "tenantNameAr": site->name_ar,
        "tenantSlug": site->slug.current
      }`,
      { cutoff3m, cutoff2h }
    )

    if (!unacceptedOrders?.length) {
      return NextResponse.json({ ok: true, notifiedCount: 0 })
    }

    let notifiedCount = 0
    const nowIso = new Date().toISOString()

    for (const order of unacceptedOrders) {
      try {
        const phone = order.tenantPhone?.trim()
        if (phone) {
          const businessName = order.tenantNameAr?.trim() || order.tenantName?.trim() || 'Business'
          
          const result = await sendWhatsAppTemplateMessage(
            phone,
            'new_order',
            [businessName],
            'ar_EG',
            `${order.tenantSlug}/orders` // Note: this must match your WhatsApp template exact configuration
          )

          if (result.success) {
            notifiedCount++
          } else {
            console.error(`[cron/unaccepted-orders-whatsapp] Failed to send to ${phone} for order ${order._id}`, result.error)
          }
        }

        // We mark it as notified even if we failed to send or there is no phone,
        // so we don't keep trying and failing every minute for the next 2 hours.
        await writeClient.patch(order._id).set({ businessWhatsappNotifiedAt: nowIso }).commit()
      } catch (e) {
        console.error('[cron/unaccepted-orders-whatsapp] Failed processing order', order._id, e)
      }
    }

    return NextResponse.json({ ok: true, notifiedCount })
  } catch (error) {
    console.error('[cron/unaccepted-orders-whatsapp] Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
