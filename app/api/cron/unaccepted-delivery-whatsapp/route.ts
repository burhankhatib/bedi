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

  // Find delivery orders that are waiting for a driver for > 3 minutes,
  // haven't exceeded the 3 retry limit for WhatsApp driver notifications,
  // and were requested within the last 2 hours.
  const now = Date.now()
  const cutoff3m = new Date(now - 3 * 60 * 1000).toISOString()
  const cutoff2h = new Date(now - 2 * 60 * 60 * 1000).toISOString()

  try {
    const unacceptedOrders = await writeClient.fetch<{
      _id: string
      city?: string
      tenantName?: string
      tenantNameAr?: string
      driversWhatsappNotifiedCount?: number
    }[]>(
      `*[
        _type == "order" &&
        orderType == "delivery" &&
        defined(deliveryRequestedAt) &&
        status in ["new", "preparing", "waiting_for_delivery"] &&
        !defined(assignedDriver) &&
        (
          (!defined(driversWhatsappNotifiedAt) && deliveryRequestedAt <= $cutoff3m) ||
          (defined(driversWhatsappNotifiedAt) && driversWhatsappNotifiedAt <= $cutoff3m)
        ) &&
        (!defined(driversWhatsappNotifiedCount) || driversWhatsappNotifiedCount < 3) &&
        deliveryRequestedAt >= $cutoff2h
      ]{
        _id,
        "city": site->city,
        "tenantName": site->name,
        "tenantNameAr": site->name_ar,
        driversWhatsappNotifiedCount
      }`,
      { cutoff3m, cutoff2h }
    )

    if (!unacceptedOrders?.length) {
      return NextResponse.json({ ok: true, notifiedCount: 0 })
    }

    let notifiedOrdersCount = 0
    let totalMessagesSent = 0
    const nowIso = new Date().toISOString()

    for (const order of unacceptedOrders) {
      try {
        if (!order.city) {
          // Mark as notified so we don't keep trying if there's no city
          const currentCount = order.driversWhatsappNotifiedCount || 0
          await writeClient.patch(order._id)
            .set({ driversWhatsappNotifiedAt: nowIso })
            .set({ driversWhatsappNotifiedCount: currentCount + 1 })
            .commit()
          continue
        }

        // Fetch verified drivers in this city
        const drivers = await writeClient.fetch<{ phoneNumber: string }[]>(
          `*[
            _type == "driver" && 
            isVerifiedByAdmin == true &&
            city == $city &&
            defined(phoneNumber)
          ]{ phoneNumber }`,
          { city: order.city }
        )

        if (drivers && drivers.length > 0) {
          let messagesSentForOrder = 0

          for (const driver of drivers) {
            const phone = driver.phoneNumber?.trim()
            if (phone) {
              const result = await sendWhatsAppTemplateMessage(
                phone,
                'new_deliver',
                [],
                'ar_EG'
              )

              if (result.success) {
                messagesSentForOrder++
                totalMessagesSent++
              } else {
                console.error(`[cron/unaccepted-delivery-whatsapp] Failed to send to ${phone} for order ${order._id}`, result.error)
              }
            }
          }

          if (messagesSentForOrder > 0) {
            notifiedOrdersCount++
          }
        }

        // Mark it as notified and increment count
        const currentCount = order.driversWhatsappNotifiedCount || 0
        await writeClient.patch(order._id)
          .set({ driversWhatsappNotifiedAt: nowIso })
          .set({ driversWhatsappNotifiedCount: currentCount + 1 })
          .commit()
      } catch (e) {
        console.error('[cron/unaccepted-delivery-whatsapp] Failed processing order', order._id, e)
      }
    }

    return NextResponse.json({ ok: true, notifiedOrdersCount, totalMessagesSent })
  } catch (error) {
    console.error('[cron/unaccepted-delivery-whatsapp] Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
