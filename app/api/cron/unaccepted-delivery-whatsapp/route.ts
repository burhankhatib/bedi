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
  const cutoff3h = new Date(now - 3 * 60 * 60 * 1000).toISOString()
  const singleOrderId = url.searchParams.get('orderId')?.trim()

  if (singleOrderId) {
    try {
      const order = await writeClient.fetch<{
        _id: string
        city?: string
        tenantName?: string
        tenantNameAr?: string
        driversWhatsappNotifiedCount?: number
      } | null>(
        `*[
          _type == "order" &&
          _id == $orderId &&
          orderType == "delivery" &&
          defined(deliveryRequestedAt) &&
          status in ["new", "preparing", "waiting_for_delivery"] &&
          !defined(assignedDriver) &&
          (!defined(driversWhatsappNotifiedCount) || driversWhatsappNotifiedCount < 3)
        ][0]{
          _id,
          "city": site->city,
          "tenantName": site->name,
          "tenantNameAr": site->name_ar,
          driversWhatsappNotifiedCount
        }`,
        { orderId: singleOrderId }
      )
      if (!order?._id) {
        return NextResponse.json({ ok: true, notifiedOrdersCount: 0, totalMessagesSent: 0, skipped: true })
      }

      let messagesSentForOrder = 0
      const nowIso = new Date().toISOString()
      if (order.city) {
        const drivers = await writeClient.fetch<{ _id: string; phoneNumber: string; isOnline: boolean }[]>(
          `*[
            _type == "driver" && 
            isVerifiedByAdmin == true &&
            city == $city &&
            defined(phoneNumber) &&
            (
              isOnline == true || 
              (
                isOnline != true && 
                receiveOfflineWhatsapp != false && 
                (!defined(lastOfflineWhatsappAt) || lastOfflineWhatsappAt <= $cutoff3h)
              )
            )
          ]{ _id, phoneNumber, isOnline }`,
          { city: order.city, cutoff3h }
        )
        for (const driver of drivers || []) {
          const phone = driver.phoneNumber?.trim()
          if (!phone) continue
          let result = await sendWhatsAppTemplateMessage(phone, 'new_delivery', [], 'ar_EG')
          if (!result.success) {
            let errorStr = ''
            if (result.error) {
              if (typeof result.error === 'string') errorStr = result.error
              else if ((result.error as { error?: { error_data?: { details?: string } } }).error?.error_data?.details) {
                errorStr = (result.error as { error?: { error_data?: { details?: string } } }).error?.error_data?.details || ''
              } else if ((result.error as { error?: { message?: string } }).error?.message) {
                errorStr = (result.error as { error?: { message?: string } }).error?.message || ''
              } else errorStr = JSON.stringify(result.error)
            }
            if (errorStr.includes('does not exist in ar_EG') || errorStr.includes('does not exist in ar')) {
              result = await sendWhatsAppTemplateMessage(phone, 'new_delivery', [], 'ar')
            }
          }
          if (result.success) {
            messagesSentForOrder++
            if (!driver.isOnline) {
              await writeClient.patch(driver._id).set({ lastOfflineWhatsappAt: nowIso }).commit().catch(() => {})
            }
          }
        }
      }

      const currentCount = order.driversWhatsappNotifiedCount || 0
      await writeClient.patch(order._id)
        .set({ driversWhatsappNotifiedAt: nowIso })
        .set({ driversWhatsappNotifiedCount: currentCount + 1 })
        .commit()

      return NextResponse.json({
        ok: true,
        notifiedOrdersCount: messagesSentForOrder > 0 ? 1 : 0,
        totalMessagesSent: messagesSentForOrder,
        orderId: singleOrderId,
      })
    } catch (error) {
      console.error('[cron/unaccepted-delivery-whatsapp] single order failed:', error)
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  }

  const allowLegacyScan = process.env.ENABLE_LEGACY_SANITY_SCAN_CRONS === 'true'
  if (!allowLegacyScan) {
    return NextResponse.json({ ok: true, notifiedOrdersCount: 0, totalMessagesSent: 0, skipped: true, reason: 'legacy-scan-disabled' })
  }

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
        const drivers = await writeClient.fetch<{ _id: string; phoneNumber: string; isOnline: boolean }[]>(
          `*[
            _type == "driver" && 
            isVerifiedByAdmin == true &&
            city == $city &&
            defined(phoneNumber) &&
            (
              isOnline == true || 
              (
                isOnline != true && 
                receiveOfflineWhatsapp != false && 
                (!defined(lastOfflineWhatsappAt) || lastOfflineWhatsappAt <= $cutoff3h)
              )
            )
          ]{ _id, phoneNumber, isOnline }`,
          { city: order.city, cutoff3h }
        )

        if (drivers && drivers.length > 0) {
          let messagesSentForOrder = 0

          for (const driver of drivers) {
            const phone = driver.phoneNumber?.trim()
            if (phone) {
              let result = await sendWhatsAppTemplateMessage(
                phone,
                'new_delivery',
                [],
                'ar_EG'
              )

              if (!result.success) {
                let errorStr = ''
                if (result.error) {
                  if (typeof result.error === 'string') {
                    errorStr = result.error
                  } else if (result.error.error?.error_data?.details) {
                    errorStr = result.error.error.error_data.details
                  } else if (result.error.error?.message) {
                    errorStr = result.error.error.message
                  } else {
                    errorStr = JSON.stringify(result.error)
                  }
                }
                
                if (errorStr.includes('does not exist in ar_EG') || errorStr.includes('does not exist in ar')) {
                  result = await sendWhatsAppTemplateMessage(
                    phone,
                    'new_delivery',
                    [],
                    'ar'
                  )
                }
              }

              if (result.success) {
                messagesSentForOrder++
                totalMessagesSent++
                if (!driver.isOnline) {
                  try {
                    await writeClient.patch(driver._id).set({ lastOfflineWhatsappAt: nowIso }).commit()
                  } catch (patchErr) {
                    console.error(`[cron/unaccepted-delivery-whatsapp] Failed to update lastOfflineWhatsappAt for driver ${driver._id}`, patchErr)
                  }
                }
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
