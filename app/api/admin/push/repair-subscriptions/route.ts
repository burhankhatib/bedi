import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { isSuperAdminEmail } from '@/lib/constants'
import { upsertUserPushSubscription } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * Super-admin utility:
 * Rebuild central userPushSubscription docs from legacy push fields for tenant/staff/driver/customer.
 */
export async function POST(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const dryRun = Boolean(body?.dryRun)
  const limit = Math.min(Math.max(Number(body?.limit) || 1000, 1), 5000)

  let scanned = 0
  let skipped = 0
  let created = 0
  let updated = 0
  const typeStats: Record<string, number> = {
    tenants: 0,
    tenantStaff: 0,
    drivers: 0,
    customersFromOrders: 0,
  }

  // 1) Tenant owners (legacy tokens -> central tenant role + site)
  const tenants = await writeClient.fetch<Array<{ _id: string; clerkUserId?: string; fcmToken?: string; fcmTokens?: string[] }>>(
    `*[_type == "tenant" && defined(clerkUserId) && (defined(fcmToken) || count(fcmTokens) > 0)][0...$limit]{
      _id, clerkUserId, fcmToken, fcmTokens
    }`,
    { limit }
  )
  for (const row of tenants ?? []) {
    scanned += 1
    const clerkUserId = (row.clerkUserId ?? '').trim()
    if (!clerkUserId) {
      skipped += 1
      continue
    }
    const tokens = [...new Set([...(row.fcmTokens ?? []), ...(row.fcmToken ? [row.fcmToken] : [])].filter(Boolean))]
    if (tokens.length === 0) {
      skipped += 1
      continue
    }
    for (const fcmToken of tokens) {
      if (dryRun) continue
      const result = await upsertUserPushSubscription({
        clerkUserId,
        roleContext: 'tenant',
        siteIds: [row._id],
        fcmToken,
      })
      if (result?.created) created += 1
      else if (result) updated += 1
    }
    typeStats.tenants += 1
  }

  // 2) Tenant staff (legacy tokens/web push -> central tenant role + staff site)
  const staffRows = await writeClient.fetch<Array<{
    _id: string
    clerkUserId?: string
    siteId?: string
    fcmTokens?: string[]
    pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
  }>>(
    `*[_type == "tenantStaff" && defined(clerkUserId) && (count(fcmTokens) > 0 || defined(pushSubscription.endpoint))][0...$limit]{
      _id,
      clerkUserId,
      "siteId": site._ref,
      fcmTokens,
      "pushSubscription": pushSubscription
    }`,
    { limit }
  )
  for (const row of staffRows ?? []) {
    scanned += 1
    const clerkUserId = (row.clerkUserId ?? '').trim()
    if (!clerkUserId || !row.siteId) {
      skipped += 1
      continue
    }
    for (const fcmToken of [...new Set((row.fcmTokens ?? []).filter(Boolean))]) {
      if (dryRun) continue
      const result = await upsertUserPushSubscription({
        clerkUserId,
        roleContext: 'tenant',
        siteIds: [row.siteId],
        fcmToken,
      })
      if (result?.created) created += 1
      else if (result) updated += 1
    }
    const wp = row.pushSubscription
    if (wp?.endpoint && wp?.p256dh && wp?.auth) {
      if (!dryRun) {
        const result = await upsertUserPushSubscription({
          clerkUserId,
          roleContext: 'tenant',
          siteIds: [row.siteId],
          webPush: { endpoint: wp.endpoint, p256dh: wp.p256dh, auth: wp.auth },
        })
        if (result?.created) created += 1
        else if (result) updated += 1
      }
    }
    typeStats.tenantStaff += 1
  }

  // 3) Drivers (legacy tokens/web push -> central driver role)
  const driverRows = await writeClient.fetch<Array<{
    _id: string
    clerkUserId?: string
    fcmToken?: string
    pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
  }>>(
    `*[_type == "driver" && defined(clerkUserId) && (defined(fcmToken) || defined(pushSubscription.endpoint))][0...$limit]{
      _id, clerkUserId, fcmToken, "pushSubscription": pushSubscription
    }`,
    { limit }
  )
  for (const row of driverRows ?? []) {
    scanned += 1
    const clerkUserId = (row.clerkUserId ?? '').trim()
    if (!clerkUserId) {
      skipped += 1
      continue
    }
    if (row.fcmToken?.trim()) {
      if (!dryRun) {
        const result = await upsertUserPushSubscription({
          clerkUserId,
          roleContext: 'driver',
          fcmToken: row.fcmToken.trim(),
        })
        if (result?.created) created += 1
        else if (result) updated += 1
      }
    }
    const wp = row.pushSubscription
    if (wp?.endpoint && wp?.p256dh && wp?.auth) {
      if (!dryRun) {
        const result = await upsertUserPushSubscription({
          clerkUserId,
          roleContext: 'driver',
          webPush: { endpoint: wp.endpoint, p256dh: wp.p256dh, auth: wp.auth },
        })
        if (result?.created) created += 1
        else if (result) updated += 1
      }
    }
    typeStats.drivers += 1
  }

  // 4) Customers from order-level legacy fields (same source as old backfill route)
  const orderRows = await writeClient.fetch<
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
  for (const row of orderRows ?? []) {
    scanned += 1
    const clerkUserId = (row.clerkUserId ?? '').trim()
    if (!clerkUserId) {
      skipped += 1
      continue
    }
    if (row.customerFcmToken?.trim()) {
      if (!dryRun) {
        const result = await upsertUserPushSubscription({
          clerkUserId,
          roleContext: 'customer',
          fcmToken: row.customerFcmToken.trim(),
        })
        if (result?.created) created += 1
        else if (result) updated += 1
      }
    }
    const wp = row.customerPushSubscription
    if (wp?.endpoint && wp?.p256dh && wp?.auth) {
      if (!dryRun) {
        const result = await upsertUserPushSubscription({
          clerkUserId,
          roleContext: 'customer',
          webPush: { endpoint: wp.endpoint, p256dh: wp.p256dh, auth: wp.auth },
        })
        if (result?.created) created += 1
        else if (result) updated += 1
      }
    }
    typeStats.customersFromOrders += 1
  }

  return NextResponse.json({
    success: true,
    dryRun,
    limit,
    scanned,
    skipped,
    created,
    updated,
    typeStats,
  })
}
