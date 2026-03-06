import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendWhatsAppTemplateMessage } from '@/lib/meta-whatsapp'

export const dynamic = 'force-dynamic'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  // Find orders that are 'new', haven't been notified yet, 
  // and were created between 5 minutes and 2 hours ago.
  const now = Date.now()
  const cutoff5m = new Date(now - 5 * 60 * 1000).toISOString()
  const cutoff2h = new Date(now - 2 * 60 * 60 * 1000).toISOString()

  try {
    const unacceptedOrders = await writeClient.fetch<{
      _id: string
      tenantPhone?: string
      tenantName?: string
      tenantNameAr?: string
    }[]>(
      `*[
        _type == "order" &&
        status == "new" &&
        !defined(businessWhatsappNotifiedAt) &&
        createdAt <= $cutoff5m &&
        createdAt >= $cutoff2h
      ]{
        _id,
        "tenantPhone": site->ownerPhone,
        "tenantName": site->name,
        "tenantNameAr": site->name_ar
      }`,
      { cutoff5m, cutoff2h }
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
          
          const sent = await sendWhatsAppTemplateMessage(
            phone,
            'new_order_waiting',
            [businessName],
            'ar'
          )

          if (sent) {
            notifiedCount++
          } else {
            console.error(`[cron/unaccepted-orders-whatsapp] Failed to send to ${phone} for order ${order._id}`)
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
