/**
 * Send push (FCM + Web Push) to the tenant (owner) and all staff members.
 * Primary: queries central userPushSubscription table (same system as Customer FCM).
 * Fallback: legacy fcmTokens arrays on tenant / tenantStaff documents.
 *
 * IMPORTANT: Uses noCdnClient for ALL reads so newly-saved subscriptions are
 * always visible (CDN cache can lag by up to 60 s, causing missed notifications).
 */

import { clientNoCdn } from '@/sanity/lib/client'
import { token as sanityWriteToken } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { removeDevice } from '@/lib/user-push-subscriptions'

export type TenantPushPayload = {
  title: string
  body: string
  url: string
  /** Absolute URL to the business icon shown in the notification. */
  icon?: string
  dir?: 'rtl' | 'ltr'
}

// ──────────────────────────────────────────────────────────
// Types for legacy docs
// ──────────────────────────────────────────────────────────
type LegacyDoc = {
  _id: string
  fcmToken?: string
  fcmTokens?: string[]
  pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
}

type StaleToken = { docId: string; token: string; docType: 'tenant' | 'tenantStaff' }

// ──────────────────────────────────────────────────────────
// Central subscription type
// ──────────────────────────────────────────────────────────
type CentralSub = {
  _id: string
  clerkUserId: string
  roleContext: 'tenant' | 'customer' | 'driver'
  devices?: Array<{
    _key: string
    fcmToken?: string
    webPush?: { endpoint: string; p256dh: string; auth: string }
  }>
}

// ──────────────────────────────────────────────────────────
// Send to one FCM token (central system) — returns whether permanent failure
// ──────────────────────────────────────────────────────────
async function sendCentralFcm(
  token: string,
  payload: TenantPushPayload
): Promise<{ sent: boolean; permanent: boolean }> {
  if (!token || !isFCMConfigured()) return { sent: false, permanent: false }
  const result = await sendFCMToTokenDetailed(token, payload)
  return { sent: result.ok, permanent: !result.ok && !!result.permanent }
}

// ──────────────────────────────────────────────────────────
// Send to a legacy doc (fcmTokens array + webPush sub)
// ──────────────────────────────────────────────────────────
async function sendToLegacyDoc(
  doc: LegacyDoc,
  docType: 'tenant' | 'tenantStaff',
  payload: TenantPushPayload,
  alreadySentTokens: Set<string>
): Promise<{ sent: boolean; staleTokens: StaleToken[] }> {
  let sent = false
  const staleTokens: StaleToken[] = []

  const allTokens = [
    ...(doc.fcmTokens ?? []),
    ...(doc.fcmToken ? [doc.fcmToken] : []),
  ].filter((t, i, arr) => t && arr.indexOf(t) === i && !alreadySentTokens.has(t))

  if (isFCMConfigured() && allTokens.length > 0) {
    for (const tok of allTokens) {
      const result = await sendFCMToTokenDetailed(tok, payload)
      if (result.ok) {
        sent = true
      } else if (result.permanent) {
        staleTokens.push({ docId: doc._id, token: tok, docType })
      }
    }
  }

  const sub = doc.pushSubscription
  if (sub?.endpoint && sub?.p256dh && sub?.auth && isPushConfigured() && !alreadySentTokens.has(sub.endpoint)) {
    const ok = await sendPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    )
    if (ok) sent = true
  }

  return { sent, staleTokens }
}

// ──────────────────────────────────────────────────────────
// Prune stale tokens from legacy docs
// ──────────────────────────────────────────────────────────
async function pruneStaleTokens(staleTokens: StaleToken[]): Promise<void> {
  if (!staleTokens.length || !sanityWriteToken) return
  const writeClient = clientNoCdn.withConfig({ token: sanityWriteToken })

  const byDoc = new Map<string, StaleToken[]>()
  for (const s of staleTokens) {
    if (!byDoc.has(s.docId)) byDoc.set(s.docId, [])
    byDoc.get(s.docId)!.push(s)
  }

  for (const [docId, tokens] of byDoc) {
    try {
      const doc = await writeClient.fetch<LegacyDoc | null>(
        `*[_id == $id][0]{ _id, fcmToken, fcmTokens }`,
        { id: docId }
      )
      if (!doc) continue
      const badSet = new Set(tokens.map((s) => s.token))
      const cleanTokens = (doc.fcmTokens ?? []).filter((t) => !badSet.has(t))
      const cleanLegacy = doc.fcmToken && badSet.has(doc.fcmToken) ? undefined : doc.fcmToken

      const patch = writeClient.patch(docId).set({ fcmTokens: cleanTokens })
      if (cleanLegacy === undefined && doc.fcmToken) patch.unset(['fcmToken'])
      await patch.commit()
    } catch (e) {
      console.warn('[tenant-push] prune stale token failed for', docId, e)
    }
  }
}

// ──────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────
export async function sendTenantAndStaffPush(
  tenantId: string,
  payload: TenantPushPayload
): Promise<boolean> {
  if (!isFCMConfigured() && !isPushConfigured()) return false

  // Step 1: fetch tenant clerkUserId + all staff clerkUserIds (noCdn for fresh data)
  const [tenantDoc, staffList] = await Promise.all([
    clientNoCdn.fetch<{ _id: string; clerkUserId?: string; fcmToken?: string; fcmTokens?: string[]; pushSubscription?: LegacyDoc['pushSubscription'] } | null>(
      `*[_type == "tenant" && _id == $id][0]{ _id, clerkUserId, fcmToken, fcmTokens, "pushSubscription": pushSubscription }`,
      { id: tenantId }
    ),
    clientNoCdn.fetch<Array<{ _id: string; clerkUserId?: string; fcmToken?: string; fcmTokens?: string[]; pushSubscription?: LegacyDoc['pushSubscription'] }>>(
      `*[_type == "tenantStaff" && site._ref == $tenantId]{ _id, clerkUserId, fcmTokens, "pushSubscription": pushSubscription }`,
      { tenantId }
    ),
  ])

  // Collect all Clerk user IDs (tenant owner + staff who have clerkUserId saved)
  const clerkUserIds = [
    tenantDoc?.clerkUserId,
    ...(staffList ?? []).map((s) => s.clerkUserId),
  ].filter((id): id is string => !!id)

  // Step 2: query central userPushSubscription table for ALL matching users or site (noCdn)
  let centralSubs: CentralSub[] = []
  if (clerkUserIds.length > 0 || tenantId) {
    try {
      centralSubs = await clientNoCdn.fetch<CentralSub[]>(
        `*[
          _type == "userPushSubscription" &&
          roleContext == "tenant" &&
          ($tenantId in sites[]._ref || clerkUserId in $ids) &&
          isActive != false
        ]{ _id, clerkUserId, roleContext, devices }`,
        { ids: clerkUserIds, tenantId }
      )
    } catch (e) {
      console.error(`[tenant-push] FAILED to query central subscriptions for tenant ${tenantId}:`, e)
      centralSubs = []
    }
  }

  console.log(`[tenant-push] Resolving central subs for tenant ${tenantId}. found: ${centralSubs.length}. clerkUserIds: ${clerkUserIds.join(', ')}`)

  let sent = false
  // Track tokens already sent via central so we don't double-send via legacy
  const sentTokens = new Set<string>()

  // Array to hold cleanup promises for central devices
  const centralCleanupPromises: Promise<void>[] = []

  if (centralSubs.length === 0) {
    console.warn(`[tenant-push] No central push subscriptions found for tenant ${tenantId}`)
  }
  if (clerkUserIds.length === 0) {
    console.warn(`[tenant-push] No clerkUserIds found for tenant ${tenantId} or its staff`)
  }

  // Step 3: send via central subscriptions
  for (const sub of centralSubs) {
    if (!sub.devices || sub.devices.length === 0) continue

    for (const device of sub.devices) {
      let fcmSent = false
      if (device.fcmToken) {
        console.log(`[tenant-push] Sending to central FCM token: ${device.fcmToken.substring(0, 10)}...`)
        const { sent: ok, permanent } = await sendCentralFcm(device.fcmToken, payload)
        if (ok) {
          sent = true
          fcmSent = true
          sentTokens.add(device.fcmToken)
        }
        if (permanent) {
          centralCleanupPromises.push(
            removeDevice({
              clerkUserId: sub.clerkUserId,
              roleContext: sub.roleContext,
              fcmToken: device.fcmToken,
            })
          )
        }
      }
      // Web push via central sub
      if (!fcmSent && device.webPush) {
        const wp = device.webPush
        if (wp.endpoint && wp.p256dh && wp.auth && isPushConfigured()) {
          console.log(`[tenant-push] Sending to central WebPush endpoint: ${wp.endpoint.substring(0, 20)}...`)
          const ok = await sendPushNotification(
            { endpoint: wp.endpoint, keys: { p256dh: wp.p256dh, auth: wp.auth } },
            payload
          )
          if (ok) {
            sent = true
            sentTokens.add(wp.endpoint)
          } else {
             centralCleanupPromises.push(
                removeDevice({
                  clerkUserId: sub.clerkUserId,
                  roleContext: sub.roleContext,
                  endpoint: wp.endpoint,
                })
             )
          }
        }
      }
    }
  }

  // Step 4: send via legacy fields (only tokens not already sent above)
  const allLegacy: Array<{ doc: LegacyDoc; docType: 'tenant' | 'tenantStaff' }> = []
  if (tenantDoc) allLegacy.push({ doc: tenantDoc, docType: 'tenant' })
  for (const staff of staffList ?? []) allLegacy.push({ doc: staff, docType: 'tenantStaff' })
  
  console.log(`[tenant-push] Resolving legacy docs. Found: ${allLegacy.length}`)

  const allStaleTokens: StaleToken[] = []
  for (const { doc, docType } of allLegacy) {
    console.log(`[tenant-push] Sending to legacy doc: ${doc._id} (${docType})`)
    const { sent: ok, staleTokens } = await sendToLegacyDoc(doc, docType, payload, sentTokens)
    if (ok) sent = true
    allStaleTokens.push(...staleTokens)
  }
  
  if (allLegacy.length > 0) {
    console.log(`[tenant-push] Legacy docs processed. Outcome: sent=${sent}, staleTokens=${allStaleTokens.length}`)
  }

  // Fire-and-forget cleanup
  if (centralCleanupPromises.length > 0) {
    Promise.all(centralCleanupPromises).catch((e) => console.warn('[tenant-push] central prune error', e))
  }
  if (allStaleTokens.length > 0) {
    pruneStaleTokens(allStaleTokens).catch((e) => console.warn('[tenant-push] legacy prune error', e))
  }

  if (!sent) {
    console.error(
      `[tenant-push] ⚠️ PUSH NOT DELIVERED for tenant ${tenantId}. ` +
      `centralSubs=${centralSubs.length}, ` +
      `totalDevices=${centralSubs.reduce((n, s) => n + (s.devices?.length ?? 0), 0)}, ` +
      `legacyDocs=${allLegacy.length}, ` +
      `clerkUserIds=[${clerkUserIds.join(',')}]. ` +
      `Payload: ${payload.title}`
    )
  }

  return sent
}
