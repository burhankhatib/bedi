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

  // Find delivery orders that are waiting for a driver, haven't been notified to drivers yet, 
  // and were created between 3 minutes and 2 hours ago.
  const now = Date.now()
  const cutoff3m = new Date(now - 3 * 60 * 1000).toISOString()
  const cutoff2h = new Date(now - 2 * 60 * 60 * 1000).toISOString()

  try {
    const unacceptedOrders = await writeClient.fetch<{
      _id: string
      city?: string
      tenantName?: string
      tenantNameAr?: string
    }[]>(
      `*[
        _type == "order" &&
        orderType == "delivery" &&
        status in ["preparing", "waiting_for_delivery"] &&
        !defined(assignedDriver) &&
        !defined(driversWhatsappNotifiedAt) &&
        createdAt <= $cutoff3m &&
        createdAt >= $cutoff2h
      ]{
        _id,
        "city": site->city,
        "tenantName": site->name,
        "tenantNameAr": site->name_ar
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
          await writeClient.patch(order._id).set({ driversWhatsappNotifiedAt: nowIso }).commit()
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
          const businessName = order.tenantNameAr?.trim() || order.tenantName?.trim() || 'Business'
          
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bedi.delivery'
          const base = baseUrl.replace(/\/$/, '')
          const driverUrl = `${base}/driver` // Link to driver portal

          let messagesSentForOrder = 0

          for (const driver of drivers) {
            const phone = driver.phoneNumber?.trim()
            if (phone) {
              // We use the new_order template which accepts business name and URL
              const result = await sendWhatsAppTemplateMessage(
                phone,
                'new_order',
                [businessName, driverUrl],
                'ar'
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

        // Mark it as notified
        await writeClient.patch(order._id).set({ driversWhatsappNotifiedAt: nowIso }).commit()
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
