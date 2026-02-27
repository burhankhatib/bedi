import { NextRequest, NextResponse } from 'next/server'
import { token } from '@/sanity/lib/token'
import { client } from '@/sanity/lib/client'
import { upsertUserPushSubscription } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.PUSH_BACKFILL_SECRET
  if (!expected) return false
  const header = req.headers.get('x-backfill-secret') || ''
  return header === expected
}

/**
 * One-time backfill:
 * Copies legacy order-level customer push tokens into centralized userPushSubscription documents.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const limit = Math.min(Math.max(Number(body?.limit) || 500, 1), 5000)
  const dryRun = Boolean(body?.dryRun)

  const rows = await writeClient.fetch<
    Array<{
      _id: string
      clerkUserId?: string
      customerFcmToken?: string
      customerPushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
    }>
  >(
    `*[
      _type == "order" &&
      defined(customer._ref) &&
      (defined(customerFcmToken) || defined(customerPushSubscription.endpoint))
    ][0...$limit]{
      _id,
      "clerkUserId": customer->clerkUserId,
      customerFcmToken,
      "customerPushSubscription": customerPushSubscription
    }`,
    { limit }
  )

  let scanned = 0
  let skipped = 0
  let created = 0
  let updated = 0

  for (const row of rows ?? []) {
    scanned += 1
    const clerkUserId = (row.clerkUserId ?? '').trim()
    if (!clerkUserId) {
      skipped += 1
      continue
    }
    if (dryRun) continue

    if (row.customerFcmToken?.trim()) {
      const result = await upsertUserPushSubscription({
        clerkUserId,
        roleContext: 'customer',
        fcmToken: row.customerFcmToken,
      })
      if (result?.created) created += 1
      else if (result) updated += 1
    }

    const sub = row.customerPushSubscription
    if (sub?.endpoint && sub?.p256dh && sub?.auth) {
      const result = await upsertUserPushSubscription({
        clerkUserId,
        roleContext: 'customer',
        webPush: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      })
      if (result?.created) created += 1
      else if (result) updated += 1
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    scanned,
    skipped,
    created,
    updated,
  })
}
