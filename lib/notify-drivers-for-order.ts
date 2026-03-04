import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function notifyDriversOfDeliveryOrder(orderId: string): Promise<void> {
  const pushReady = isFCMConfigured() || isPushConfigured()
  if (!pushReady) return

  try {
    const order = await writeClient.fetch<{
      siteRef?: string
      totalAmount?: number
      deliveryFee?: number
      currency?: string
      deliveryAreaNameAr?: string
      deliveryAreaNameEn?: string
      declinedByDriverRefs?: string[]
    } | null>(
      `*[_type == "order" && _id == $orderId][0]{
        "siteRef": site._ref,
        totalAmount,
        deliveryFee,
        currency,
        "deliveryAreaNameAr": deliveryArea->name_ar,
        "deliveryAreaNameEn": deliveryArea->name_en,
        "declinedByDriverRefs": declinedByDriverIds[]._ref
      }`,
      { orderId }
    )

    const RTL_MARK = '\u200F' // Unicode RIGHT-TO-LEFT MARK for RTL alignment
    let businessName = 'توصيل'
    if (order?.siteRef) {
      const businessInfo = await writeClient.fetch<{ name_ar?: string; name_en?: string } | null>(
        `*[_type == "restaurantInfo" && site._ref == $siteId][0]{ name_ar, name_en }`,
        { siteId: order.siteRef }
      )
      const ar = businessInfo?.name_ar && String(businessInfo.name_ar).trim()
      const en = businessInfo?.name_en && String(businessInfo.name_en).trim()
      if (ar || en) {
        businessName = ar || en || businessName
      } else {
        const tenant = await writeClient.fetch<{ name?: string } | null>(
          `*[_type == "tenant" && _id == $id][0]{ name }`,
          { id: order.siteRef }
        )
        businessName = (tenant?.name && String(tenant.name).trim()) || businessName
      }
    }

    const currency = order?.currency?.trim() || '₪'
    const total = typeof order?.totalAmount === 'number' ? order.totalAmount.toFixed(2) : '0.00'
    const fee = typeof order?.deliveryFee === 'number' ? order.deliveryFee.toFixed(2) : '0.00'
    const areaName = (order?.deliveryAreaNameAr && String(order.deliveryAreaNameAr).trim()) ||
      (order?.deliveryAreaNameEn && String(order.deliveryAreaNameEn).trim()) ||
      ''
    const bodyAr = areaName
      ? `${businessName} - عليك دفع ${total} ${currency} - التوصيل ${fee} ${currency} (${areaName})`
      : `${businessName} - عليك دفع ${total} ${currency} - التوصيل ${fee} ${currency}`
    const titleAr = 'طلب توصيل جديد'
    const payload = {
      title: RTL_MARK + titleAr,
      body: RTL_MARK + bodyAr,
      url: '/driver/orders',
      dir: 'rtl' as const,
    }

    type DriverRow = {
      _id: string
      fcmToken?: string
      pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
      country?: string
      city?: string
    }
    const drivers = await writeClient.fetch<DriverRow[]>(
      `*[_type == "driver" && isOnline == true && (defined(fcmToken) || defined(pushSubscription.endpoint))]{ _id, fcmToken, "pushSubscription": pushSubscription, country, city }`
    )
    const list = drivers ?? []
    const declinedSet = new Set(order?.declinedByDriverRefs ?? [])

    const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()
    let matching: DriverRow[] = []

    if (order?.siteRef) {
      const site = await writeClient.fetch<{ country?: string; city?: string } | null>(
        `*[_type == "tenant" && _id == $id][0]{ country, city }`,
        { id: order.siteRef }
      )
      if (site?.country && site?.city) {
        const siteCountryNorm = norm(site.country)
        const siteCityNorm = norm(site.city)
        matching = list.filter(
          (d) =>
            ((norm(d.country) === siteCountryNorm && norm(d.city) === siteCityNorm) ||
              (!d.country && !d.city)) &&
            !declinedSet.has(d._id)
        )
        if (matching.length === 0) matching = list.filter((d) => !declinedSet.has(d._id))
      } else {
        matching = list.filter((d) => !declinedSet.has(d._id))
        if (process.env.NODE_ENV === 'development') {
          console.warn('[request-driver] Tenant has no country/city; sending push to all', list.length, 'online drivers')
        }
      }
    } else {
      matching = list.filter((d) => !declinedSet.has(d._id))
    }

    if (process.env.NODE_ENV === 'development' && (list.length > 0 || matching.length > 0)) {
      console.info('[request-driver]', list.length, 'online driver(s) with push,', matching.length, 'matching (excluding', declinedSet.size, 'who declined)')
    }

    for (const d of matching) {
      let sent = false
      if (d.fcmToken && isFCMConfigured()) {
        sent = await sendFCMToToken(d.fcmToken, payload)
      }
      if (!sent) {
        const sub = d.pushSubscription
        if (sub?.endpoint && sub?.p256dh && sub?.auth && isPushConfigured()) {
          const ok = await sendPushNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
          if (process.env.NODE_ENV === 'development' && !ok) {
            console.warn('[request-driver] Web Push send returned false for one driver')
          }
        }
      }
    }

    // Send offline driver reminders (once per 4 hours, between 9AM–10PM KSA = UTC+3)
    const nowMs = Date.now()
    const ksaHour = new Date(nowMs + 3 * 60 * 60 * 1000).getUTCHours()
    if (ksaHour >= 9 && ksaHour < 22 && order?.siteRef) {
      const site = await writeClient.fetch<{ country?: string; city?: string } | null>(
        `*[_type == "tenant" && _id == $id][0]{ country, city }`,
        { id: order.siteRef }
      )
      if (site?.country && site?.city) {
        const siteCountryNorm = norm(site.country)
        const siteCityNorm = norm(site.city)
        const fourHoursAgo = new Date(nowMs - 4 * 60 * 60 * 1000).toISOString()

        type OfflineDriverRow = {
          _id: string
          fcmToken?: string
          pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
          country?: string
          city?: string
          lastOfflineReminderAt?: string
        }
        const offlineDrivers = await writeClient.fetch<OfflineDriverRow[]>(
          `*[_type == "driver" && isOnline != true && (defined(fcmToken) || defined(pushSubscription.endpoint)) && !defined(blockedBySuperAdmin) || blockedBySuperAdmin == false]{
            _id, fcmToken, "pushSubscription": pushSubscription, country, city, lastOfflineReminderAt
          }`
        )
        const eligibleOffline = (offlineDrivers ?? []).filter(
          (d) =>
            (norm(d.country) === siteCountryNorm && norm(d.city) === siteCityNorm) &&
            (!d.lastOfflineReminderAt || d.lastOfflineReminderAt < fourHoursAgo)
        )
        const reminderPayload = {
          title: '\u200Fتنبيه: طلبات توصيل متاحة',
          body: '\u200Fيوجد طلبات توصيل متاحة في منطقتك! افتح التطبيق واستقبل الطلبات لزيادة أرباحك.',
          url: '/driver/orders',
          dir: 'rtl' as const,
        }
        const reminderNow = new Date(nowMs).toISOString()
        for (const d of eligibleOffline) {
          let sent = false
          if (d.fcmToken && isFCMConfigured()) {
            sent = await sendFCMToToken(d.fcmToken, reminderPayload)
          }
          if (!sent) {
            const sub = d.pushSubscription
            if (sub?.endpoint && sub?.p256dh && sub?.auth && isPushConfigured()) {
              await sendPushNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                reminderPayload
              )
            }
          }
          // Update throttle timestamp regardless of delivery success
          writeClient.patch(d._id).set({ lastOfflineReminderAt: reminderNow }).commit().catch(() => {})
        }
      }
    }
  } catch (error) {
    console.error('[notifyDriversOfDeliveryOrder] Failed to notify drivers:', error)
  }
}
