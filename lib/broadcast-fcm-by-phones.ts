import { client } from '@/sanity/lib/client'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { canonicalWhatsAppInboxPhone } from '@/lib/whatsapp-inbox-phone'

type Recipient = {
  name: string
  phone: string
}

type PushSubscription = {
  _id: string
  clerkUserId: string
  roleContext: string
  devices?: Array<{
    fcmToken?: string
    webPush?: { endpoint?: string; p256dh?: string; auth?: string }
  }>
}

/**
 * Maps a chunk of recipients to their Clerk user IDs and sends them a push notification
 * via active FCM / Web Push subscriptions.
 */
export async function sendFCMByPhones(
  recipients: Recipient[],
  payload: { title: string; body: string; url?: string }
): Promise<{ sent: number; failed: number }> {
  const pushReady = isFCMConfigured() || isPushConfigured()
  if (!pushReady || recipients.length === 0) return { sent: 0, failed: 0 }

  // 1. Gather all normalized phone numbers from the chunk
  const normalizedPhones = recipients.map((r) => canonicalWhatsAppInboxPhone(r.phone)).filter(Boolean)
  if (normalizedPhones.length === 0) return { sent: 0, failed: 0 }

  // 2. Query Sanity to find user IDs associated with these phones across tenants, drivers, and customers
  // We check multiple phone formats just in case, but rely mostly on the canonical one or standard E.164.
  // We can just query all matching docs where the relevant phone field matches any of our target phones.
  // Since phones in Sanity might contain '+', we can check both raw and with '+'.
  const plusPhones = normalizedPhones.map((p) => `+${p}`)
  const queryPhones = [...normalizedPhones, ...plusPhones]

  const userIdsResult = await client.fetch<{ clerkUserId: string }[]>(
    `*[
      (_type == "tenant" && ownerPhone in $phones) ||
      (_type == "driver" && phoneNumber in $phones) ||
      (_type == "customer" && primaryPhone in $phones)
    ]{ clerkUserId }`,
    { phones: queryPhones }
  )

  const userIds = Array.from(new Set(userIdsResult.map((doc) => doc.clerkUserId).filter(Boolean)))

  if (userIds.length === 0) return { sent: 0, failed: 0 }

  // 3. Load active push subscriptions for these user IDs
  const subs = await client.fetch<PushSubscription[]>(
    `*[_type == "userPushSubscription" && isActive != false && clerkUserId in $userIds]{
      _id,
      clerkUserId,
      roleContext,
      devices
    }`,
    { userIds }
  )

  let sent = 0
  let failed = 0
  const seenTokens = new Set<string>()

  const fullPayload = { ...payload, url: payload.url ?? '/' }

  // 4. Dispatch
  for (const sub of subs) {
    const devices = Array.isArray(sub.devices) ? sub.devices : []
    for (const dev of devices) {
      if (dev.fcmToken && isFCMConfigured()) {
        const key = `fcm:${dev.fcmToken}`
        if (!seenTokens.has(key)) {
          seenTokens.add(key)
          if (await sendFCMToToken(dev.fcmToken, fullPayload)) {
            sent++
          } else {
            failed++
          }
        }
      }
      if (dev.webPush?.endpoint && dev.webPush?.p256dh && dev.webPush?.auth && isPushConfigured()) {
        const key = `wp:${dev.webPush.endpoint}`
        if (!seenTokens.has(key)) {
          seenTokens.add(key)
          if (
            await sendPushNotification(
              { endpoint: dev.webPush!.endpoint!, keys: { p256dh: dev.webPush!.p256dh!, auth: dev.webPush!.auth! } },
              fullPayload
            )
          ) {
            sent++
          } else {
            failed++
          }
        }
      }
    }
  }

  return { sent, failed }
}
