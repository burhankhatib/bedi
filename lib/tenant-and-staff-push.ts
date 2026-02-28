/**
 * Send push (FCM + Web Push) to the tenant (owner) and all staff members.
 * Primary: queries central userPushSubscription table (same system as Customer FCM).
 * Fallback: legacy fcmTokens arrays on tenant / tenantStaff documents.
 */

import { client } from '@/sanity/lib/client'
import { token as sanityWriteToken } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { markSubscriptionInactive } from '@/lib/user-push-subscriptions'

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
  fcmToken?: string
  webPush?: { endpoint: string; p256dh: string; auth: string }
}

// ──────────────────────────────────────────────────────────
// Send to one FCM token (central system) — returns whether permanent failure
// ──────────────────────────────────────────────────────────
async function sendCentralFcm(
  sub: CentralSub,
  payload: TenantPushPayload
): Promise<{ sent: boolean; permanent: boolean }> {
  if (!sub.fcmToken || !isFCMConfigured()) return { sent: false, permanent: false }
  const result = await sendFCMToTokenDetailed(sub.fcmToken, payload)
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
  if (sub?.endpoint && sub?.p256dh && sub?.auth && isPushConfigured()) {
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
  const writeClient = client.withConfig({ token: sanityWriteToken, useCdn: false })

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

  // Step 1: fetch tenant clerkUserId + all staff clerkUserIds
  const [tenantDoc, staffList] = await Promise.all([
    client.fetch<{ _id: string; clerkUserId?: string; fcmToken?: string; fcmTokens?: string[]; pushSubscription?: LegacyDoc['pushSubscription'] } | null>(
      `*[_type == "tenant" && _id == $id][0]{ _id, clerkUserId, fcmToken, fcmTokens, "pushSubscription": pushSubscription }`,
      { id: tenantId }
    ),
    client.fetch<Array<{ _id: string; clerkUserId?: string; fcmToken?: string; fcmTokens?: string[]; pushSubscription?: LegacyDoc['pushSubscription'] }>>(
      `*[_type == "tenantStaff" && site._ref == $tenantId]{ _id, clerkUserId, fcmTokens, "pushSubscription": pushSubscription }`,
      { tenantId }
    ),
  ])

  // Collect all Clerk user IDs (tenant owner + staff who have clerkUserId saved)
  const clerkUserIds = [
    tenantDoc?.clerkUserId,
    ...(staffList ?? []).map((s) => s.clerkUserId),
  ].filter((id): id is string => !!id)

  // Step 2: query central userPushSubscription table for ALL matching users
  let centralSubs: CentralSub[] = []
  if (clerkUserIds.length > 0) {
    centralSubs = await client.fetch<CentralSub[]>(
      `*[
        _type == "userPushSubscription" &&
        clerkUserId in $ids &&
        roleContext == "tenant" &&
        isActive != false
      ]{ _id, fcmToken, "webPush": webPush }`,
      { ids: clerkUserIds }
    ).catch(() => [])
  }

  let sent = false
  const staleCentralIds: string[] = []
  // Track tokens already sent via central so we don't double-send via legacy
  const sentTokens = new Set<string>()

  // Step 3: send via central subscriptions
  for (const sub of centralSubs) {
    if (sub.fcmToken) {
      const { sent: ok, permanent } = await sendCentralFcm(sub, payload)
      if (ok) {
        sent = true
        sentTokens.add(sub.fcmToken)
      }
      if (permanent) staleCentralIds.push(sub._id)
    }
    // Web push via central sub
    const wp = sub.webPush
    if (wp?.endpoint && wp?.p256dh && wp?.auth && isPushConfigured()) {
      const ok = await sendPushNotification(
        { endpoint: wp.endpoint, keys: { p256dh: wp.p256dh, auth: wp.auth } },
        payload
      )
      if (ok) sent = true
    }
  }

  // Step 4: send via legacy fields (only tokens not already sent above)
  const allLegacy: Array<{ doc: LegacyDoc; docType: 'tenant' | 'tenantStaff' }> = []
  if (tenantDoc) allLegacy.push({ doc: tenantDoc, docType: 'tenant' })
  for (const staff of staffList ?? []) allLegacy.push({ doc: staff, docType: 'tenantStaff' })

  const allStaleTokens: StaleToken[] = []
  for (const { doc, docType } of allLegacy) {
    const { sent: ok, staleTokens } = await sendToLegacyDoc(doc, docType, payload, sentTokens)
    if (ok) sent = true
    allStaleTokens.push(...staleTokens)
  }

  // Fire-and-forget cleanup
  if (staleCentralIds.length > 0) {
    Promise.all(
      staleCentralIds.map((id) => markSubscriptionInactive({ id, reason: 'fcm-permanent-failure' }))
    ).catch((e) => console.warn('[tenant-push] central prune error', e))
  }
  if (allStaleTokens.length > 0) {
    pruneStaleTokens(allStaleTokens).catch((e) => console.warn('[tenant-push] legacy prune error', e))
  }

  return sent
}
