import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { removeDevice } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })
const OFFLINE_REMINDER_INTERVAL_MS = 2 * 60 * 60 * 1000

type CentralSub = { clerkUserId: string; devices?: Array<{ fcmToken?: string; webPush?: { endpoint?: string; p256dh?: string; auth?: string } }> }

async function getDriverTokens(
  d: { _id: string; clerkUserId?: string; fcmToken?: string; pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string } },
  centralByClerk: Map<string, CentralSub[]>
): Promise<{ fcmTokens: string[]; webPush: Array<{ endpoint: string; p256dh: string; auth: string }> }> {
  const fcmTokens: string[] = []
  const webPush: Array<{ endpoint: string; p256dh: string; auth: string }> = []
  if (d.fcmToken && d.fcmToken.trim()) fcmTokens.push(d.fcmToken.trim())
  const sub = d.pushSubscription
  if (sub?.endpoint && sub?.p256dh && sub?.auth) {
    webPush.push({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
  }
  const clerkUserId = (d.clerkUserId ?? '').trim()
  if (clerkUserId) {
    const central = centralByClerk.get(clerkUserId) ?? []
    for (const c of central) {
      for (const dev of c.devices ?? []) {
        if (dev.fcmToken && !fcmTokens.includes(dev.fcmToken)) fcmTokens.push(dev.fcmToken)
        const wp = dev.webPush
        if (wp?.endpoint && wp?.p256dh && wp?.auth && !webPush.some((w) => w.endpoint === wp.endpoint)) {
          webPush.push({ endpoint: wp.endpoint, p256dh: wp.p256dh, auth: wp.auth })
        }
      }
    }
  }
  return { fcmTokens, webPush }
}

type DriverCleanupContext = { driverId: string; clerkUserId?: string; legacyFcmToken?: string }

async function sendToDriverTokens(
  tokens: { fcmTokens: string[]; webPush: Array<{ endpoint: string; p256dh: string; auth: string }> },
  payload: { title: string; body: string; url: string; dir: 'rtl' },
  driverCtx?: DriverCleanupContext
): Promise<boolean> {
  let sent = false
  const payloadWithDataOnly = { ...payload, dataOnly: true as const }
  for (const tok of tokens.fcmTokens) {
    if (!isFCMConfigured()) break
    const result = await sendFCMToTokenDetailed(tok, payloadWithDataOnly)
    if (result.ok) {
      sent = true
      break
    }
    if (result.permanent && driverCtx?.clerkUserId) {
      await removeDevice({ clerkUserId: driverCtx.clerkUserId, roleContext: 'driver', fcmToken: tok }).catch(() => {})
      if (tok === driverCtx.legacyFcmToken) {
        writeClient.patch(driverCtx.driverId).unset(['fcmToken']).commit().catch(() => {})
      }
    }
  }
  if (!sent && isPushConfigured()) {
    for (const wp of tokens.webPush) {
      if (await sendPushNotification({ endpoint: wp.endpoint, keys: { p256dh: wp.p256dh, auth: wp.auth } }, payload)) {
        sent = true
        break
      }
    }
  }
  return sent
}

export async function notifyDriversOfDeliveryOrder(orderId: string): Promise<void> {
  const pushReady = isFCMConfigured() || isPushConfigured()
  if (!pushReady) return

  try {
    const order = await writeClient.fetch<{
      siteRef?: string
      totalAmount?: number
      deliveryFee?: number
      shopperFee?: number
      currency?: string
      declinedByDriverRefs?: string[]
    } | null>(
      `*[_type == "order" && _id == $orderId][0]{
        "siteRef": site._ref,
        totalAmount,
        deliveryFee,
        shopperFee,
        currency,
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
    const deliveryFee = typeof order?.deliveryFee === 'number' ? order.deliveryFee.toFixed(2) : '0.00'
    const shopperFee = typeof order?.shopperFee === 'number' ? order.shopperFee.toFixed(2) : '0.00'
    const hasShopperFee = (order?.shopperFee ?? 0) > 0
    const bodyAr = hasShopperFee
      ? `${businessName} - المجموع ${total} ${currency} · التوصيل ${deliveryFee} ${currency} · رسوم توفير الوقت ${shopperFee} ${currency}`
      : `${businessName} - عليك دفع ${total} ${currency} · التوصيل ${deliveryFee} ${currency} (حسب المسافة)`
    const titleAr = 'طلب توصيل جديد'
    const payload = {
      title: RTL_MARK + titleAr,
      body: RTL_MARK + bodyAr,
      url: '/driver/orders',
      dir: 'rtl' as const,
    }

    type DriverRow = {
      _id: string
      clerkUserId?: string
      fcmToken?: string
      pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
      country?: string
      city?: string
    }
    // Drivers with an active delivery (assigned, not completed) must NOT receive new order notifications
    const activeDriverRows = await writeClient.fetch<Array<{ driverId: string }>>(
      `*[_type == "order" && orderType == "delivery" && status != "cancelled" && status != "refunded" && status != "completed" && status != "served" && defined(assignedDriver)]{ "driverId": assignedDriver._ref }`
    )
    const busyDriverIds = new Set((activeDriverRows ?? []).map((r) => r.driverId).filter(Boolean))
    // Include clerkUserId; don't require fcmToken on driver doc — we also use central userPushSubscription
    const drivers = await writeClient.fetch<DriverRow[]>(
      `*[_type == "driver" && isOnline == true && isVerifiedByAdmin == true && (!defined(blockedBySuperAdmin) || blockedBySuperAdmin == false)]{ _id, clerkUserId, fcmToken, "pushSubscription": pushSubscription, country, city }`
    )
    const list = drivers ?? []
    const clerkIds = list.map((d) => (d.clerkUserId ?? '').trim()).filter(Boolean)
    let centralSubs: CentralSub[] = []
    if (clerkIds.length > 0) {
      centralSubs = await writeClient.fetch<CentralSub[]>(
        `*[_type == "userPushSubscription" && roleContext == "driver" && clerkUserId in $ids && isActive != false]{ clerkUserId, devices }`,
        { ids: clerkIds }
      ).catch(() => [])
    }
    const centralByClerk = new Map<string, CentralSub[]>()
    for (const c of centralSubs) {
      if (!c.clerkUserId) continue
      const arr = centralByClerk.get(c.clerkUserId) ?? []
      arr.push(c)
      centralByClerk.set(c.clerkUserId, arr)
    }

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
            !busyDriverIds.has(d._id) &&
            ((norm(d.country) === siteCountryNorm && norm(d.city) === siteCityNorm) ||
              (!d.country && !d.city)) &&
            !declinedSet.has(d._id)
        )
        if (matching.length === 0) matching = list.filter((d) => !busyDriverIds.has(d._id) && !declinedSet.has(d._id))
      } else {
        matching = list.filter((d) => !busyDriverIds.has(d._id) && !declinedSet.has(d._id))
        if (process.env.NODE_ENV === 'development') {
          console.warn('[request-driver] Tenant has no country/city; sending push to all', list.length, 'online drivers')
        }
      }
    } else {
      matching = list.filter((d) => !busyDriverIds.has(d._id) && !declinedSet.has(d._id))
    }

    const driversWithPush = matching.filter((d) => d.fcmToken || d.pushSubscription?.endpoint || (d.clerkUserId && centralByClerk.has((d.clerkUserId ?? '').trim())))
    if (process.env.NODE_ENV === 'development' && (list.length > 0 || matching.length > 0)) {
      console.info('[request-driver]', list.length, 'online driver(s),', driversWithPush.length, 'with push tokens,', matching.length, 'matching')
    }

    for (const d of matching) {
      const tokens = await getDriverTokens(d, centralByClerk)
      if (tokens.fcmTokens.length === 0 && tokens.webPush.length === 0) continue
      const driverCtx: DriverCleanupContext = {
        driverId: d._id,
        clerkUserId: (d.clerkUserId ?? '').trim() || undefined,
        legacyFcmToken: (d.fcmToken ?? '').trim() || undefined,
      }
      await sendToDriverTokens(tokens, payload, driverCtx)
    }

    // Send offline driver reminders (once per 2 hours per driver) — "go online to receive orders"
    if (order?.siteRef) {
      const nowMs = Date.now()
      const reminderCutoff = new Date(nowMs - OFFLINE_REMINDER_INTERVAL_MS).toISOString()
      type OfflineDriverRow = {
        _id: string
        clerkUserId?: string
        fcmToken?: string
        pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
        country?: string
        city?: string
        lastOfflineReminderAt?: string
      }
      const offlineDrivers = await writeClient.fetch<OfflineDriverRow[]>(
        `*[_type == "driver" && isVerifiedByAdmin == true && isOnline != true && (!defined(blockedBySuperAdmin) || blockedBySuperAdmin == false)]{
          _id, clerkUserId, fcmToken, "pushSubscription": pushSubscription, country, city, lastOfflineReminderAt
        }`
      )
      const reminderPayload = {
        title: '\u200Fتنبيه: طلبات توصيل متاحة',
        body: '\u200Fيوجد طلبات توصيل متاحة في منطقتك! افتح التطبيق واتصل بالإنترنت لاستقبال الطلبات.',
        url: '/driver/orders',
        dir: 'rtl' as const,
      }
      const reminderNow = new Date(nowMs).toISOString()
      const site = await writeClient.fetch<{ country?: string; city?: string } | null>(
        `*[_type == "tenant" && _id == $id][0]{ country, city }`,
        { id: order.siteRef }
      )
      const siteCountryNorm = site?.country ? norm(site.country) : ''
      const siteCityNorm = site?.city ? norm(site.city) : ''
      const hasGeo = Boolean(site?.country && site?.city)

      const eligibleOffline = (offlineDrivers ?? []).filter((d) => {
        if (d.lastOfflineReminderAt && d.lastOfflineReminderAt >= reminderCutoff) return false
        if (hasGeo) {
          const matchArea = norm(d.country) === siteCountryNorm && norm(d.city) === siteCityNorm
          const noArea = !d.country && !d.city
          return matchArea || noArea
        }
        return true
      })

      const offlineClerkIds = eligibleOffline.map((d) => (d.clerkUserId ?? '').trim()).filter(Boolean)
      let offlineCentral: CentralSub[] = []
      if (offlineClerkIds.length > 0) {
        offlineCentral = await writeClient.fetch<CentralSub[]>(
          `*[_type == "userPushSubscription" && roleContext == "driver" && clerkUserId in $ids && isActive != false]{ clerkUserId, devices }`,
          { ids: offlineClerkIds }
        ).catch(() => [])
      }
      const offlineCentralByClerk = new Map<string, CentralSub[]>()
      for (const c of offlineCentral) {
        if (!c.clerkUserId) continue
        const arr = offlineCentralByClerk.get(c.clerkUserId) ?? []
        arr.push(c)
        offlineCentralByClerk.set(c.clerkUserId, arr)
      }
      for (const d of eligibleOffline) {
        const tokens = await getDriverTokens({ ...d, pushSubscription: d.pushSubscription }, offlineCentralByClerk)
        if (tokens.fcmTokens.length === 0 && tokens.webPush.length === 0) continue
        const driverCtx: DriverCleanupContext = {
          driverId: d._id,
          clerkUserId: (d.clerkUserId ?? '').trim() || undefined,
          legacyFcmToken: (d.fcmToken ?? '').trim() || undefined,
        }
        await sendToDriverTokens(tokens, reminderPayload, driverCtx)
        writeClient.patch(d._id).set({ lastOfflineReminderAt: reminderNow }).commit().catch(() => {})
      }
    }
  } catch (error) {
    console.error('[notifyDriversOfDeliveryOrder] Failed to notify drivers:', error)
  }
}
