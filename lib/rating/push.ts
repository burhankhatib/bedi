import { clientNoCdn } from '@/sanity/lib/client'
import { isPushConfigured, sendPushNotificationDetailed } from '@/lib/push'
import { isFCMConfigured, sendFCMToTokenDetailed } from '@/lib/fcm'
import { getActiveSubscriptionsForUser, removeDevice } from '@/lib/user-push-subscriptions'
import { RoleContext } from '@/lib/user-push-subscriptions'

type PushPayload = {
  title: string
  body: string
  url: string
  icon?: string
}

async function getClerkUserId(sanityDocId: string, role: string): Promise<string | null> {
  if (role === 'business' || role === 'tenant') {
    const doc = await clientNoCdn.fetch<{ clerkUserId?: string, coOwnerEmails?: string[] } | null>(
      `*[_type == "tenant" && _id == $id][0]{ clerkUserId, coOwnerEmails }`,
      { id: sanityDocId }
    )
    return doc?.clerkUserId || null
  }
  
  const typeMap: Record<string, string> = {
    customer: 'customer',
    driver: 'driver'
  }
  
  const type = typeMap[role]
  if (!type) return null

  const doc = await clientNoCdn.fetch<{ clerkUserId?: string } | null>(
    `*[_type == $type && _id == $id][0]{ clerkUserId }`,
    { type, id: sanityDocId }
  )
  return doc?.clerkUserId || null
}

async function sendPushToSanityUser(sanityDocId: string, role: string, roleContext: RoleContext, payload: PushPayload) {
  const clerkUserId = await getClerkUserId(sanityDocId, role)
  if (!clerkUserId) return false

  if (!isFCMConfigured() && !isPushConfigured()) return false

  const subs = await getActiveSubscriptionsForUser({ clerkUserId, roleContext })
  if (subs.length === 0) return false

  let sentAny = false
  const cleanupPromises: Promise<void>[] = []

  for (const sub of subs) {
    if (!Array.isArray(sub.devices)) continue

    for (const device of sub.devices) {
      let delivered = false

      if (device.fcmToken && isFCMConfigured()) {
        const res = await sendFCMToTokenDetailed(device.fcmToken, {
          ...payload,
          dataOnly: false // Let FCM handle it directly if needed, or stick to dataOnly if PWA requires
        })
        if (res.ok) delivered = true
        else if (res.permanent) {
          cleanupPromises.push(removeDevice({ clerkUserId, roleContext, fcmToken: device.fcmToken }))
        }
      }

      if (!delivered && device.webPush?.endpoint && isPushConfigured()) {
        const res = await sendPushNotificationDetailed(
          { endpoint: device.webPush.endpoint, keys: device.webPush },
          payload
        )
        if (res.ok) delivered = true
        else if (res.permanent) {
          cleanupPromises.push(removeDevice({ clerkUserId, roleContext, endpoint: device.webPush.endpoint }))
        }
      }

      if (delivered) sentAny = true
    }
  }

  if (cleanupPromises.length > 0) {
    Promise.all(cleanupPromises).catch(e => console.warn('[rating-push] cleanup error', e))
  }

  return sentAny
}

export async function sendRatingPromptPush(targetSanityId: string, targetRole: string, promptUrl: string) {
  const roleContextMap: Record<string, RoleContext> = {
    customer: 'customer',
    driver: 'driver',
    business: 'tenant'
  }
  
  const roleContext = roleContextMap[targetRole]
  if (!roleContext) return false

  const payload: PushPayload = {
    title: 'Rate your experience',
    body: 'How was your recent order? Tap to leave a quick rating.',
    url: promptUrl,
  }

  return sendPushToSanityUser(targetSanityId, targetRole, roleContext, payload)
}

export async function sendRatingReceivedPush(targetSanityId: string, targetRole: string, newScore: number) {
  const roleContextMap: Record<string, RoleContext> = {
    customer: 'customer',
    driver: 'driver',
    business: 'tenant'
  }
  
  const roleContext = roleContextMap[targetRole]
  if (!roleContext) return false

  const payload: PushPayload = {
    title: 'New Rating Received',
    body: `You received a ${newScore}-star rating on a recent order.`,
    url: targetRole === 'business' ? '/manage/reviews' : targetRole === 'driver' ? '/driver/profile' : '/profile',
  }

  return sendPushToSanityUser(targetSanityId, targetRole, roleContext, payload)
}
