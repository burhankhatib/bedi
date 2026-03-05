import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { sendPushNotification, sendPushNotificationDetailed, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { getActiveSubscriptionsForUser, markSubscriptionInactive } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const verified = body.verified === true

  try {
    const driver = await client.fetch<{ _id: string; clerkUserId?: string; fcmToken?: string; pushSubscription?: any; isVerifiedByAdmin?: boolean } | null>(
      `*[_type == "driver" && _id == $id][0]{ _id, clerkUserId, fcmToken, pushSubscription, isVerifiedByAdmin }`,
      { id }
    )

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    if (driver.isVerifiedByAdmin !== verified) {
      await writeClient
        .patch(id)
        .set({ isVerifiedByAdmin: verified })
        .commit()

      if (verified) {
        const title = 'تم تفعيل حسابك! ✅'
        const pushBody = 'مبروك! تمت مراجعة حسابك وتفعيله بنجاح. يمكنك الآن الانتقال لحالة "متصل" والبدء باستقبال طلبات التوصيل.'
        const url = '/driver/orders'

        const payload = {
          title,
          body: pushBody,
          url,
          icon: '/icon-192x192.png',
          dir: 'rtl' as const,
        }

        let sent = false

        if (driver.clerkUserId) {
          const subs = await getActiveSubscriptionsForUser({ clerkUserId: driver.clerkUserId, roleContext: 'driver' })
          for (const sub of subs) {
            let fcmSent = false
            if (sub.fcmToken && isFCMConfigured()) {
              const res = await sendFCMToTokenDetailed(sub.fcmToken, payload)
              if (res.ok) {
                fcmSent = true
                sent = true
              } else if (res.permanent) {
                await markSubscriptionInactive({ id: sub._id, reason: res.reason || 'fcm_permanent_failure' })
              }
            }
            if (!fcmSent && sub.webPush?.endpoint && sub.webPush?.p256dh && sub.webPush?.auth && isPushConfigured()) {
              const res = await sendPushNotificationDetailed({ endpoint: sub.webPush.endpoint, keys: { p256dh: sub.webPush.p256dh, auth: sub.webPush.auth } }, payload)
              if (res.ok) {
                sent = true
              } else if (res.permanent) {
                await markSubscriptionInactive({ id: sub._id, reason: res.reason || 'webpush_permanent_failure' })
              }
            }
          }
        }

        if (!sent) {
          let legacySent = false
          if (driver.fcmToken && isFCMConfigured()) {
            legacySent = await sendFCMToToken(driver.fcmToken, payload)
            if (legacySent) sent = true
          }
          if (!legacySent && driver.pushSubscription?.endpoint && driver.pushSubscription?.p256dh && driver.pushSubscription?.auth && isPushConfigured()) {
            const ok = await sendPushNotification({ endpoint: driver.pushSubscription.endpoint, keys: { p256dh: driver.pushSubscription.p256dh, auth: driver.pushSubscription.auth } }, payload)
            if (ok) sent = true
          }
        }
        
        console.log(`[Admin] Sent verification push to driver ${id}: ${sent}`)
      }
    }

    return NextResponse.json({ success: true, isVerifiedByAdmin: verified })
  } catch (error) {
    console.error('[Admin] Verify driver failed:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
