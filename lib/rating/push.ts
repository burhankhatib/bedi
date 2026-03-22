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

async function getClerkUserAndSlug(sanityDocId: string, role: string): Promise<{ clerkUserId: string | null; slug?: string }> {
  if (role === 'business' || role === 'tenant') {
    const doc = await clientNoCdn.fetch<{ clerkUserId?: string, 'slug': string } | null>(
      `*[_type == "tenant" && _id == $id][0]{ clerkUserId, "slug": slug.current }`,
      { id: sanityDocId }
    )
    return { clerkUserId: doc?.clerkUserId || null, slug: doc?.slug }
  }
  
  const typeMap: Record<string, string> = {
    customer: 'customer',
    driver: 'driver'
  }
  
  const type = typeMap[role]
  if (!type) return { clerkUserId: null }

  const doc = await clientNoCdn.fetch<{ clerkUserId?: string } | null>(
    `*[_type == $type && _id == $id][0]{ clerkUserId }`,
    { type, id: sanityDocId }
  )
  return { clerkUserId: doc?.clerkUserId || null }
}

async function sendPushToSanityUser(sanityDocId: string, role: string, roleContext: RoleContext, payload: PushPayload | ((slug?: string) => PushPayload)) {
  const { clerkUserId, slug } = await getClerkUserAndSlug(sanityDocId, role)
  if (!clerkUserId) {
    console.warn(`[rating-push] Missing clerkUserId for sanityDocId=${sanityDocId} role=${role}. Push skipped.`)
    return false
  }

  const finalPayload = typeof payload === 'function' ? payload(slug) : payload

  if (!isFCMConfigured() && !isPushConfigured()) return false

  const subs = await getActiveSubscriptionsForUser({ clerkUserId, roleContext })
  if (subs.length === 0) {
    console.warn(`[rating-push] No active push subscriptions for clerkUserId=${clerkUserId} roleContext=${roleContext}.`)
    return false
  }

  let sentAny = false
  const cleanupPromises: Promise<void>[] = []

  for (const sub of subs) {
    if (!Array.isArray(sub.devices)) continue

    for (const device of sub.devices) {
      let delivered = false

      if (device.fcmToken && isFCMConfigured()) {
        const res = await sendFCMToTokenDetailed(device.fcmToken, {
          ...finalPayload,
          dataOnly: false
        })
        if (res.ok) delivered = true
        else if (res.permanent) {
          cleanupPromises.push(removeDevice({ clerkUserId, roleContext, fcmToken: device.fcmToken }))
        }
      }

      if (!delivered && device.webPush?.endpoint && isPushConfigured()) {
        const res = await sendPushNotificationDetailed(
          { endpoint: device.webPush.endpoint, keys: device.webPush },
          finalPayload
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

export async function sendRatingPromptPush(raterSanityId: string, raterRole: string, targetRole: string, promptUrl: string) {
  const roleContextMap: Record<string, RoleContext> = {
    customer: 'customer',
    driver: 'driver',
    business: 'tenant'
  }
  
  const roleContext = roleContextMap[raterRole]
  if (!roleContext) return false

  let title = 'Rate your experience'
  let body = 'How was your recent order? Tap to leave a quick rating.'
  let dir: 'rtl' | 'ltr' | undefined = undefined

  if (raterRole === 'driver' && targetRole === 'business') {
    title = 'قيّم المطعم'
    body = 'نرجو تقييم تجربتك مع المطعم بعد التوصيل.'
    dir = 'rtl'
  } else if (raterRole === 'customer') {
    title = 'Rate your experience | قيّم تجربتك'
    body = 'How was your recent order? Tap to leave a quick rating. | كيف كان طلبك الأخير؟ اضغط للتقييم.'
  } else if (raterRole === 'business' && targetRole === 'driver') {
    title = 'Rate the driver'
    body = 'How was the driver for your recent order?'
  }

  const payload = {
    title,
    body,
    url: promptUrl,
    ...(dir ? { dir } : {})
  }

  return sendPushToSanityUser(raterSanityId, raterRole, roleContext, payload as any)
}

export async function sendRatingReceivedPush(targetSanityId: string, targetRole: string, newScore: number) {
  const roleContextMap: Record<string, RoleContext> = {
    customer: 'customer',
    driver: 'driver',
    business: 'tenant'
  }
  
  const roleContext = roleContextMap[targetRole]
  if (!roleContext) return false

  return sendPushToSanityUser(targetSanityId, targetRole, roleContext, (slug) => ({
    title: 'New Rating Received',
    body: `You received a ${newScore}-star rating on a recent order.`,
    url: targetRole === 'business' ? (slug ? `/t/${slug}/reviews` : '/dashboard') : targetRole === 'driver' ? '/driver/profile' : '/profile',
  }))
}
