import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { removeDevice } from '@/lib/user-push-subscriptions'
import { triggerPusherEvent } from '@/lib/pusher'
import { distanceKm } from '@/lib/maps-utils'
import { getPlatformPolygons, type Polygon } from '@/lib/platform-polygons'
import { isPointInPolygon } from '@/lib/geofencing'

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
  driverCtx?: DriverCleanupContext,
  opts?: { dataOnly?: boolean }
): Promise<boolean> {
  let sent = false
  const useDataOnly = opts?.dataOnly !== false
  const fcmPayload = useDataOnly ? { ...payload, dataOnly: true as const } : payload
  for (const tok of tokens.fcmTokens) {
    if (!isFCMConfigured()) break
    const result = await sendFCMToTokenDetailed(tok, fcmPayload)
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

// ─────────────────────────────────────────────────────────────────────────────
// SHARED CONTEXT HELPER
// ─────────────────────────────────────────────────────────────────────────────

type OrderContext = {
  orderId: string
  siteRef?: string
  totalAmount?: number
  deliveryFee?: number
  shopperFee?: number
  currency?: string
  declinedByDriverRefs?: string[]
  assignedDriverRef?: string
  businessName: string
  businessLocation?: { lat: number; lng: number }
  /** The platformArea polygon that contains the restaurant, or null if not found */
  restaurantPolygon: Polygon | null
  siteCountryNorm: string
  siteCityNorm: string
  hasGeo: boolean
}

async function fetchOrderContext(orderId: string): Promise<OrderContext | null> {
  const order = await writeClient.fetch<{
    siteRef?: string
    totalAmount?: number
    deliveryFee?: number
    shopperFee?: number
    currency?: string
    declinedByDriverRefs?: string[]
    assignedDriverRef?: string
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      "siteRef": site._ref,
      totalAmount,
      deliveryFee,
      shopperFee,
      currency,
      "declinedByDriverRefs": declinedByDriverIds[]._ref,
      "assignedDriverRef": assignedDriver._ref
    }`,
    { orderId }
  )

  if (!order) return null

  let businessName = 'توصيل'
  let locationLat: number | undefined
  let locationLng: number | undefined
  let siteCountryNorm = ''
  let siteCityNorm = ''

  if (order.siteRef) {
    // Attempt to get name from restaurantInfo first
    const businessInfo = await writeClient.fetch<{ name_ar?: string; name_en?: string } | null>(
      `*[_type == "restaurantInfo" && site._ref == $siteId][0]{ name_ar, name_en }`,
      { siteId: order.siteRef }
    )
    const ar = businessInfo?.name_ar && String(businessInfo.name_ar).trim()
    const en = businessInfo?.name_en && String(businessInfo.name_en).trim()
    
    // Get location and fallback name from tenant doc
    const tenant = await writeClient.fetch<{ name?: string; locationLat?: number; locationLng?: number; country?: string; city?: string } | null>(
      `*[_type == "tenant" && _id == $id][0]{ name, locationLat, locationLng, country, city }`,
      { id: order.siteRef }
    )
    
    businessName = ar || en || (tenant?.name && String(tenant.name).trim()) || businessName
    locationLat = tenant?.locationLat
    locationLng = tenant?.locationLng
    siteCountryNorm = (tenant?.country ?? '').trim().toLowerCase()
    siteCityNorm = (tenant?.city ?? '').trim().toLowerCase()
  }

  const businessLocation = locationLat != null && locationLng != null ? { lat: locationLat, lng: locationLng } : undefined

  // Resolve which area polygon contains the restaurant (used for strict boundary filtering)
  let restaurantPolygon: Polygon | null = null
  if (businessLocation) {
    const polygons = await getPlatformPolygons()
    restaurantPolygon = polygons.find(p =>
      isPointInPolygon([businessLocation.lng, businessLocation.lat], p.coordinates)
    ) ?? null
  }

  return {
    orderId,
    siteRef: order.siteRef,
    totalAmount: order.totalAmount,
    deliveryFee: order.deliveryFee,
    shopperFee: order.shopperFee,
    currency: order.currency,
    declinedByDriverRefs: order.declinedByDriverRefs ?? [],
    assignedDriverRef: order.assignedDriverRef,
    businessName,
    businessLocation,
    restaurantPolygon,
    siteCountryNorm,
    siteCityNorm,
    hasGeo: Boolean(siteCountryNorm && siteCityNorm)
  }
}

function buildPushPayload(ctx: OrderContext) {
  const RTL_MARK = '\u200F'
  const currency = ctx.currency?.trim() || '₪'
  const total = typeof ctx.totalAmount === 'number' ? ctx.totalAmount.toFixed(2) : '0.00'
  const deliveryFee = typeof ctx.deliveryFee === 'number' ? ctx.deliveryFee.toFixed(2) : '0.00'
  const shopperFee = typeof ctx.shopperFee === 'number' ? ctx.shopperFee.toFixed(2) : '0.00'
  const hasShopperFee = (ctx.shopperFee ?? 0) > 0
  
  const bodyAr = hasShopperFee
    ? `${ctx.businessName} - المجموع ${total} ${currency} · التوصيل ${deliveryFee} ${currency} · رسوم توفير الوقت ${shopperFee} ${currency}`
    : `${ctx.businessName} - عليك دفع ${total} ${currency} · التوصيل ${deliveryFee} ${currency} (حسب المسافة)`
  
  return {
    title: RTL_MARK + 'طلب توصيل جديد',
    body: RTL_MARK + bodyAr,
    url: '/driver/orders',
    dir: 'rtl' as const,
  }
}

type DriverRow = {
  _id: string
  clerkUserId?: string
  fcmToken?: string
  pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
  country?: string
  city?: string
  lastKnownLat?: number
  lastKnownLng?: number
  lastLocationAt?: string
}

async function getEligibleDrivers(ctx: OrderContext) {
  // Drivers with an active delivery (assigned, not completed) must NOT receive new order notifications
  const activeDriverRows = await writeClient.fetch<Array<{ driverId: string }>>(
    `*[_type == "order" && orderType == "delivery" && status != "cancelled" && status != "refunded" && status != "completed" && status != "served" && defined(assignedDriver)]{ "driverId": assignedDriver._ref }`
  )
  const busyDriverIds = new Set((activeDriverRows ?? []).map((r) => r.driverId).filter(Boolean))

  const drivers = await writeClient.fetch<DriverRow[]>(
    `*[_type == "driver" && isOnline == true && isVerifiedByAdmin == true && (!defined(blockedBySuperAdmin) || blockedBySuperAdmin == false)]{ 
      _id, clerkUserId, fcmToken, "pushSubscription": pushSubscription, country, city, lastKnownLat, lastKnownLng, lastLocationAt 
    }`
  )
  const list = drivers ?? []
  
  const declinedSet = new Set(ctx.declinedByDriverRefs)
  const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()

  let matching: DriverRow[] = []

  if (ctx.restaurantPolygon) {
    // Primary path: area polygon is known → use strict boundary enforcement.
    // Drivers with GPS must be inside the SAME polygon as the restaurant.
    // Drivers without GPS fall back to city string equality against the polygon name.
    // No cross-area fallback — if a driver is outside the area polygon they don't get notified.
    const areaNameNorm = norm(ctx.restaurantPolygon.name)
    matching = list.filter((d) => {
      if (busyDriverIds.has(d._id) || declinedSet.has(d._id)) return false
      if (d.lastKnownLat && d.lastKnownLng) {
        // GPS available: check if driver is physically inside the restaurant's area
        return isPointInPolygon([d.lastKnownLng, d.lastKnownLat], ctx.restaurantPolygon!.coordinates)
      }
      // No GPS: require city string to match the polygon area name (and same country)
      return norm(d.city) === areaNameNorm && norm(d.country) === ctx.siteCountryNorm
    })
  } else if (ctx.hasGeo) {
    // Restaurant has a city/country string but is not inside any known polygon
    // (e.g. a new city not yet drawn on the area map) → use city string equality
    matching = list.filter((d) =>
      !busyDriverIds.has(d._id) &&
      !declinedSet.has(d._id) &&
      norm(d.country) === ctx.siteCountryNorm &&
      norm(d.city) === ctx.siteCityNorm
    )
  } else {
    // Tenant has no city/country configured → last resort, all online drivers
    matching = list.filter((d) => !busyDriverIds.has(d._id) && !declinedSet.has(d._id))
  }

  // Load central push subscriptions
  const clerkIds = matching.map((d) => (d.clerkUserId ?? '').trim()).filter(Boolean)
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

  return { matching, centralByClerk }
}

async function sendToTier(drivers: DriverRow[], centralByClerk: Map<string, CentralSub[]>, payload: any) {
  let sentCount = 0
  for (const d of drivers) {
    const tokens = await getDriverTokens(d, centralByClerk)
    if (tokens.fcmTokens.length === 0 && tokens.webPush.length === 0) continue
    const driverCtx: DriverCleanupContext = {
      driverId: d._id,
      clerkUserId: (d.clerkUserId ?? '').trim() || undefined,
      legacyFcmToken: (d.fcmToken ?? '').trim() || undefined,
    }
    const sent = await sendToDriverTokens(tokens, payload, driverCtx)
    if (sent) sentCount++
  }
  return sentCount
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED NOTIFICATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggered immediately when a delivery order is placed or requested.
 * Sends push notifications to Tier 1 drivers (<= 1km radius).
 * If the restaurant has no GPS, it falls back to the legacy city-wide blast.
 */
export async function notifyDriversOfDeliveryOrder(orderId: string): Promise<void> {
  const pushReady = isFCMConfigured() || isPushConfigured()
  if (!pushReady) return

  try {
    const ctx = await fetchOrderContext(orderId)
    if (!ctx || ctx.assignedDriverRef) return

    // Wake up online drivers: force them to send a fresh GPS ping immediately.
    // This ensures Tier 2 and Tier 3 have accurate locations.
    triggerPusherEvent('private-driver-global', 'refresh-location', { orderId })

    const { matching, centralByClerk } = await getEligibleDrivers(ctx)
    const payload = buildPushPayload(ctx)

    // Check freshness: Location must be < 5 mins old to qualify for a strict tier
    const FIVE_MINS_MS = 5 * 60 * 1000
    const nowMs = Date.now()
    const isFresh = (lastLocationAt?: string) => {
      if (!lastLocationAt) return false
      return (nowMs - new Date(lastLocationAt).getTime()) < FIVE_MINS_MS
    }

    let tier1Drivers: DriverRow[] = []

    if (!ctx.businessLocation) {
      // Legacy fallback: no restaurant GPS, so blast all city drivers immediately
      tier1Drivers = matching
      if (process.env.NODE_ENV === 'development') console.warn(`[request-driver] Tenant ${ctx.siteRef} has no GPS; full city blast.`)
    } else {
      // Tier 1: <= 1km AND fresh location
      tier1Drivers = matching.filter(d => {
        if (!d.lastKnownLat || !d.lastKnownLng || !isFresh(d.lastLocationAt)) return false
        const dist = distanceKm(
          { lat: d.lastKnownLat, lng: d.lastKnownLng },
          ctx.businessLocation!
        )
        return dist <= 1.0
      })

      // If no drivers in Tier 1, we still want to proceed to Tier 2 via cron later, 
      // but we shouldn't send anything right now.
    }

    const sentCount = await sendToTier(tier1Drivers, centralByClerk, payload)
    
    // Record that Tier 1 was sent so the cron knows to start Tier 2 in 60s
    await writeClient.patch(orderId).set({ deliveryTier1SentAt: new Date().toISOString() }).commit()

    if (process.env.NODE_ENV === 'development') {
      console.info(`[request-driver] Tier 1: Sent to ${sentCount}/${tier1Drivers.length} drivers for order ${orderId}`)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OFFLINE REMINDERS (City-wide blast, max 1 per 2 hours)
    // ─────────────────────────────────────────────────────────────────────────
    if (ctx.siteRef) {
      const reminderCutoff = new Date(nowMs - OFFLINE_REMINDER_INTERVAL_MS).toISOString()
      const offlineDrivers = await writeClient.fetch<any[]>(
        `*[_type == "driver" && isVerifiedByAdmin == true && isOnline != true && (!defined(blockedBySuperAdmin) || blockedBySuperAdmin == false)]{
          _id, clerkUserId, fcmToken, "pushSubscription": pushSubscription, country, city, lastOfflineReminderAt
        }`
      )
      
      const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()
      const eligibleOffline = (offlineDrivers ?? []).filter((d) => {
        if (d.lastOfflineReminderAt && d.lastOfflineReminderAt >= reminderCutoff) return false
        if (ctx.restaurantPolygon) {
          // Area polygon known: require city string to match the polygon area name
          return norm(d.city) === norm(ctx.restaurantPolygon.name) && norm(d.country) === ctx.siteCountryNorm
        }
        if (ctx.hasGeo) {
          return norm(d.country) === ctx.siteCountryNorm && norm(d.city) === ctx.siteCityNorm
        }
        return true
      })

      if (eligibleOffline.length > 0) {
        const offlineClerkIds = eligibleOffline.map((d) => (d.clerkUserId ?? '').trim()).filter(Boolean)
        const offlineCentralSubs = await writeClient.fetch<CentralSub[]>(
          `*[_type == "userPushSubscription" && roleContext == "driver" && clerkUserId in $ids && isActive != false]{ clerkUserId, devices }`,
          { ids: offlineClerkIds }
        ).catch(() => [])
        
        const offlineMap = new Map<string, CentralSub[]>()
        for (const c of offlineCentralSubs) {
          if (!c.clerkUserId) continue
          const arr = offlineMap.get(c.clerkUserId) ?? []
          arr.push(c)
          offlineMap.set(c.clerkUserId, arr)
        }

        const reminderPayload = {
          title: '\u200Fتنبيه: طلبات توصيل متاحة',
          body: '\u200Fيوجد طلبات توصيل متاحة في منطقتك! افتح التطبيق واتصل بالإنترنت لاستقبال الطلبات.',
          url: '/driver/orders',
          dir: 'rtl' as const,
        }
        
        const reminderNow = new Date(nowMs).toISOString()
        for (const d of eligibleOffline) {
          const tokens = await getDriverTokens({ ...d, pushSubscription: d.pushSubscription }, offlineMap)
          if (tokens.fcmTokens.length === 0 && tokens.webPush.length === 0) continue
          await sendToDriverTokens(tokens, reminderPayload, {
            driverId: d._id,
            clerkUserId: (d.clerkUserId ?? '').trim() || undefined,
            legacyFcmToken: (d.fcmToken ?? '').trim() || undefined,
          }, { dataOnly: false })
          writeClient.patch(d._id).set({ lastOfflineReminderAt: reminderNow }).commit().catch(() => {})
        }
      }
    }

  } catch (error) {
    console.error('[notifyDriversOfDeliveryOrder] Failed to notify drivers:', error)
  }
}

/**
 * Called by the delivery-tier-escalation cron job.
 * Dispatches to outer rings (Tier 2: 1-2km, Tier 3: >2km or stale GPS).
 * Returns true if notifications were sent, false if order is already assigned.
 */
export async function notifyDriversEscalationTier(orderId: string, tier: 2 | 3): Promise<boolean> {
  const pushReady = isFCMConfigured() || isPushConfigured()
  if (!pushReady) return false

  try {
    const ctx = await fetchOrderContext(orderId)
    // If order already accepted or missing, abort
    if (!ctx || ctx.assignedDriverRef) return false

    // If business has no GPS, we already blasted the whole city in Tier 1. Nothing to escalate.
    if (!ctx.businessLocation) return false

    const { matching, centralByClerk } = await getEligibleDrivers(ctx)
    const payload = buildPushPayload(ctx)

    const FIVE_MINS_MS = 5 * 60 * 1000
    const nowMs = Date.now()
    const isFresh = (lastLocationAt?: string) => {
      if (!lastLocationAt) return false
      return (nowMs - new Date(lastLocationAt).getTime()) < FIVE_MINS_MS
    }

    let targetDrivers: DriverRow[] = []

    if (tier === 2) {
      // Tier 2: > 1km AND <= 2km AND fresh location
      targetDrivers = matching.filter(d => {
        if (!d.lastKnownLat || !d.lastKnownLng || !isFresh(d.lastLocationAt)) return false
        const dist = distanceKm({ lat: d.lastKnownLat, lng: d.lastKnownLng }, ctx.businessLocation!)
        return dist > 1.0 && dist <= 2.0
      })
    } else {
      // Tier 3: > 2km OR stale location OR no location at all (the rest of the city)
      targetDrivers = matching.filter(d => {
        if (!d.lastKnownLat || !d.lastKnownLng || !isFresh(d.lastLocationAt)) return true
        const dist = distanceKm({ lat: d.lastKnownLat, lng: d.lastKnownLng }, ctx.businessLocation!)
        return dist > 2.0
      })
    }

    const sentCount = await sendToTier(targetDrivers, centralByClerk, payload)

    if (process.env.NODE_ENV === 'development') {
      console.info(`[escalation-cron] Tier ${tier}: Sent to ${sentCount}/${targetDrivers.length} drivers for order ${orderId}`)
    }

    return true
  } catch (error) {
    console.error(`[notifyDriversEscalationTier] Failed to run tier ${tier} for order ${orderId}:`, error)
    return false
  }
}
