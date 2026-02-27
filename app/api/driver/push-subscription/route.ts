import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET - Whether the current driver has push enabled (fcmToken or pushSubscription). Use fresh read (no CDN) so after enabling we see the token. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const driver = await writeClient.fetch<{ fcmToken?: string; pushSubscription?: { endpoint?: string } } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ fcmToken, "pushSubscription": pushSubscription }`,
    { userId }
  )
  const hasPush = !!(driver?.fcmToken || driver?.pushSubscription?.endpoint)
  return NextResponse.json({ hasPush })
}

/** POST - Save push subscription for the current driver. Accepts FCM token and/or Web Push subscription; both can be sent so server can fall back to Web Push when FCM fails. */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  const body = await req.json().catch(() => ({}))
  const fcmToken = body?.fcmToken && typeof body.fcmToken === 'string' ? body.fcmToken.trim() : null
  const endpoint = body?.endpoint && typeof body.endpoint === 'string' ? body.endpoint : null
  const keys = body?.keys && typeof body.keys === 'object' ? body.keys : null
  const p256dh = keys?.p256dh && typeof keys.p256dh === 'string' ? keys.p256dh : null
  const authKey = keys?.auth && typeof keys.auth === 'string' ? keys.auth : null

  const hasWebPush = !!(endpoint && p256dh && authKey)
  if (!fcmToken && !hasWebPush) {
    return NextResponse.json({ error: 'fcmToken or (endpoint and keys.p256dh, keys.auth) required' }, { status: 400 })
  }

  const driver = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const patch = writeClient.patch(driver._id)
  if (fcmToken) patch.set({ fcmToken })
  if (hasWebPush) {
    patch.set({
      pushSubscription: {
        endpoint: endpoint!,
        p256dh: p256dh!,
        auth: authKey!,
      },
    })
  }
  await patch.commit()
  return NextResponse.json({ success: true, hasFcm: !!fcmToken })
}
