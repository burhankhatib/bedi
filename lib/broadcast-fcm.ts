import { client } from '@/sanity/lib/client'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { canonicalWhatsAppInboxPhone } from '@/lib/whatsapp-inbox-phone'

export type BroadcastPushRecipient = {
  name: string
  phone: string
  clerkUserId?: string
  country?: string
  city?: string
  role?: string
}

type PushSubscription = {
  _id: string
  clerkUserId: string
  roleContext: string
  devices?: Array<{
    fcmToken?: string
    pushClient?: string
    webPush?: { endpoint?: string; p256dh?: string; auth?: string }
  }>
}

export type BroadcastFcmAttemptDetail = {
  clerkUserId: string
  roleContext?: string
  transport: 'fcm' | 'web_push'
  success: boolean
  recipientName: string
  recipientPhone: string
  country?: string
  city?: string
  role?: string
}

export type BroadcastFcmSkippedRecipient = {
  recipient: BroadcastPushRecipient
  reason: string
}

function resolveClerkIdForRecipient(
  r: BroadcastPushRecipient,
  phoneToClerk: Map<string, string>
): string | undefined {
  const id = (r.clerkUserId ?? '').trim()
  if (id) return id
  const canon = canonicalWhatsAppInboxPhone(r.phone)
  if (!canon) return undefined
  return phoneToClerk.get(canon)
}

function subscriptionHasDeliverableDevices(sub: PushSubscription): boolean {
  const devices = Array.isArray(sub.devices) ? sub.devices : []
  for (const dev of devices) {
    if (dev.fcmToken?.trim() && isFCMConfigured()) return true
    const wp = dev.webPush
    if (wp?.endpoint && wp?.p256dh && wp?.auth && isPushConfigured()) return true
  }
  return false
}

/**
 * Maps a chunk of recipients to Clerk user IDs and sends FCM / Web Push.
 * Returns per-endpoint attempts and explicit skips for audit logging.
 */
export async function sendFCMToRecipients(
  recipients: BroadcastPushRecipient[],
  payload: { title: string; body: string; url?: string }
): Promise<{
  sent: number
  failed: number
  attempts: BroadcastFcmAttemptDetail[]
  skipped: BroadcastFcmSkippedRecipient[]
}> {
  const empty = { sent: 0, failed: 0, attempts: [] as BroadcastFcmAttemptDetail[], skipped: [] as BroadcastFcmSkippedRecipient[] }
  const pushReady = isFCMConfigured() || isPushConfigured()
  if (!pushReady || recipients.length === 0) {
    if (!pushReady && recipients.length > 0) {
      return {
        ...empty,
        skipped: recipients.map((r) => ({ recipient: r, reason: 'push_not_configured' })),
      }
    }
    return empty
  }

  const exactUserIds = new Set<string>()
  const phonesToFallback = new Set<string>()

  for (const r of recipients) {
    if (r.clerkUserId?.trim()) {
      exactUserIds.add(r.clerkUserId.trim())
    } else {
      const canonical = canonicalWhatsAppInboxPhone(r.phone)
      if (canonical) phonesToFallback.add(canonical)
    }
  }

  const phoneToClerk = new Map<string, string>()
  if (phonesToFallback.size > 0) {
    const normalizedPhones = Array.from(phonesToFallback)
    const plusPhones = normalizedPhones.map((p) => `+${p}`)
    const queryPhones = [...normalizedPhones, ...plusPhones]

    const paired = await client.fetch<Array<{ clerkUserId?: string; p?: string }>>(
      `*[
        (_type == "tenant" && ownerPhone in $phones) ||
        (_type == "driver" && phoneNumber in $phones) ||
        (_type == "customer" && primaryPhone in $phones)
      ]{
        clerkUserId,
        "p": select(
          _type == "tenant" => ownerPhone,
          _type == "driver" => phoneNumber,
          _type == "customer" => primaryPhone
        )
      }`,
      { phones: queryPhones }
    )
    for (const row of paired) {
      const cid = (row.clerkUserId ?? '').trim()
      const key = canonicalWhatsAppInboxPhone(row.p ?? '')
      if (cid && key) phoneToClerk.set(key, cid)
    }

    for (const doc of paired) {
      const cid = (doc.clerkUserId ?? '').trim()
      if (cid) exactUserIds.add(cid)
    }
  }

  const recipientByClerk = new Map<string, BroadcastPushRecipient>()
  for (const r of recipients) {
    const cid = resolveClerkIdForRecipient(r, phoneToClerk)
    if (cid && !recipientByClerk.has(cid)) {
      recipientByClerk.set(cid, r)
    }
  }

  const skipped: BroadcastFcmSkippedRecipient[] = []
  for (const r of recipients) {
    const cid = resolveClerkIdForRecipient(r, phoneToClerk)
    if (!cid) {
      skipped.push({ recipient: r, reason: 'no_clerk_account_for_phone' })
    }
  }

  const userIds = Array.from(exactUserIds)
  if (userIds.length === 0) {
    return { sent: 0, failed: 0, attempts: [], skipped }
  }

  const subs = await client.fetch<PushSubscription[]>(
    `*[_type == "userPushSubscription" && isActive != false && clerkUserId in $userIds]{
      _id,
      clerkUserId,
      roleContext,
      devices
    }`,
    { userIds }
  )

  const subsByClerk = new Map<string, PushSubscription[]>()
  for (const sub of subs) {
    const cid = (sub.clerkUserId ?? '').trim()
    if (!cid) continue
    const arr = subsByClerk.get(cid) ?? []
    arr.push(sub)
    subsByClerk.set(cid, arr)
  }

  for (const r of recipients) {
    const cid = resolveClerkIdForRecipient(r, phoneToClerk)
    if (!cid) continue
    const list = subsByClerk.get(cid)
    if (!list || list.length === 0) {
      skipped.push({ recipient: r, reason: 'no_push_subscription' })
      continue
    }
    const anyDevices = list.some((s) => subscriptionHasDeliverableDevices(s))
    if (!anyDevices) {
      skipped.push({ recipient: r, reason: 'no_registered_devices' })
    }
  }

  let sent = 0
  let failed = 0
  const attempts: BroadcastFcmAttemptDetail[] = []
  const seenTokens = new Set<string>()

  const fullPayload = { ...payload, url: payload.url ?? '/' }

  for (const sub of subs) {
    const cid = (sub.clerkUserId ?? '').trim()
    if (!cid) continue
    const meta = recipientByClerk.get(cid)
    const devices = Array.isArray(sub.devices) ? sub.devices : []
    for (const dev of devices) {
      if (dev.fcmToken && isFCMConfigured()) {
        const key = `fcm:${dev.fcmToken}`
        if (!seenTokens.has(key)) {
          seenTokens.add(key)
          const payloadWithClient = dev.pushClient ? { ...fullPayload, pushClient: dev.pushClient as any } : fullPayload
          const ok = await sendFCMToToken(dev.fcmToken, payloadWithClient)
          if (ok) sent++
          else failed++
          attempts.push({
            clerkUserId: cid,
            roleContext: sub.roleContext,
            transport: 'fcm',
            success: ok,
            recipientName: meta?.name ?? 'User',
            recipientPhone: meta?.phone ?? '',
            country: meta?.country,
            city: meta?.city,
            role: meta?.role,
          })
        }
      }
      if (dev.webPush?.endpoint && dev.webPush?.p256dh && dev.webPush?.auth && isPushConfigured()) {
        const key = `wp:${dev.webPush.endpoint}`
        if (!seenTokens.has(key)) {
          seenTokens.add(key)
          const ok = await sendPushNotification(
            { endpoint: dev.webPush.endpoint, keys: { p256dh: dev.webPush.p256dh, auth: dev.webPush.auth } },
            fullPayload
          )
          if (ok) sent++
          else failed++
          attempts.push({
            clerkUserId: cid,
            roleContext: sub.roleContext,
            transport: 'web_push',
            success: ok,
            recipientName: meta?.name ?? 'User',
            recipientPhone: meta?.phone ?? '',
            country: meta?.country,
            city: meta?.city,
            role: meta?.role,
          })
        }
      }
    }
  }

  return { sent, failed, attempts, skipped }
}
