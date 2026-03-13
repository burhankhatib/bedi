import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { auth } from '@clerk/nextjs/server'
import { requirePermission, ORDERS_PERMISSION } from '@/lib/staff-permissions'
import { upsertUserPushSubscription, checkDeviceToken } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

async function resolveAuthorizedTenantSiteIds(userId: string, emailLower: string): Promise<string[]> {
  const [ownedSites, staffSites] = await Promise.all([
    writeClient.fetch<Array<{ _id: string }>>(
      `*[_type == "tenant" && (
        clerkUserId == $userId ||
        (defined($emailLower) && $emailLower != "" && (
          (defined(clerkUserEmail) && lower(clerkUserEmail) == $emailLower) ||
          (defined(coOwnerEmails) && $emailLower in coOwnerEmails)
        ))
      )]{ _id }`,
      { userId, emailLower: emailLower || undefined }
    ),
    writeClient.fetch<Array<{ siteId?: string }>>(
      `*[_type == "tenantStaff" && (
        clerkUserId == $userId ||
        (defined($emailLower) && $emailLower != "" && defined(email) && lower(email) == $emailLower)
      )]{ "siteId": site._ref }`,
      { userId, emailLower: emailLower || undefined }
    ),
  ])

  return [...new Set([
    ...(ownedSites ?? []).map((s) => s?._id).filter(Boolean),
    ...(staffSites ?? []).map((s) => s?.siteId).filter(Boolean),
  ])] as string[]
}

/**
 * Push subscription for tenant new-order notifications.
 * Saves to the central userPushSubscription table (same as Customer FCM) so every
 * device / staff member can receive push reliably, regardless of token rotation.
 * Also writes fcmTokens to the legacy tenant / tenantStaff document for backward compat.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const authResult = await checkTenantAuth(slug)
  if (!authResult.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentToken = req.nextUrl.searchParams.get('token')

  if (currentToken) {
    // Health check logic
    const checkResult = await checkDeviceToken({
      clerkUserId: userId,
      roleContext: 'tenant',
      fcmToken: currentToken,
    })

    if (checkResult) {
       // status can be 'ok', 'refreshed', 'not_found'
       return NextResponse.json({ 
         hasPush: checkResult.status === 'ok' || checkResult.status === 'refreshed',
         needsRefresh: checkResult.status === 'not_found',
         status: checkResult.status 
       })
    }
  }

  // Fallback if no token provided, just check if they have any active subscription
  // Check the central subscription table first (new system)
  const centralSubs = await writeClient.fetch<Array<{ _id: string, devices?: any[] }> | null>(
    `*[_type == "userPushSubscription" && clerkUserId == $userId && roleContext == "tenant" && isActive != false][0..0]{ _id, devices }`,
    { userId }
  )
  const hasCentralPush = !!(centralSubs && centralSubs.length > 0 && centralSubs[0].devices && centralSubs[0].devices.length > 0)
  if (hasCentralPush) {
    return NextResponse.json({ hasPush: true, needsRefresh: false, status: 'ok' })
  }

  // Fall back to legacy fields (if they have legacy, they have push but need to migrate to central)
  if (authResult.isOwner) {
    const tenant = await client.fetch<{ fcmToken?: string; fcmTokens?: string[]; pushSubscription?: { endpoint?: string } } | null>(
      `*[_type == "tenant" && _id == $tenantId][0]{ fcmToken, fcmTokens, "pushSubscription": pushSubscription }`,
      { tenantId: authResult.tenantId }
    )
    const hasFcm = !!((tenant?.fcmTokens?.length ?? 0) > 0 || tenant?.fcmToken)
    const hasPush = !!(hasFcm || tenant?.pushSubscription?.endpoint)
    return NextResponse.json({ hasPush, needsRefresh: hasPush, status: hasPush ? 'needs_migration' : 'not_found' })
  }

  const { sessionClaims } = await auth()
  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  const emailLower = (email || '').trim().toLowerCase()
  const staff = await client.fetch<{ fcmTokens?: string[]; pushSubscription?: { endpoint?: string } } | null>(
    `*[_type == "tenantStaff" && site._ref == $tenantId && lower(email) == $emailLower][0]{ fcmTokens, pushSubscription }`,
    { tenantId: authResult.tenantId, emailLower }
  )
  const hasFcm = !!((staff?.fcmTokens?.length ?? 0) > 0)
  const hasPush = !!(hasFcm || staff?.pushSubscription?.endpoint)
  return NextResponse.json({ hasPush, needsRefresh: hasPush, status: hasPush ? 'needs_migration' : 'not_found' })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const authResult = await checkTenantAuth(slug)
  if (!authResult.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: authResult.status })
  if (!requirePermission(authResult, ORDERS_PERMISSION)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  const emailLower = (email || '').trim().toLowerCase()

  const body = await req.json().catch(() => ({}))
  const fcmToken = body?.fcmToken && typeof body.fcmToken === 'string' ? body.fcmToken.trim() : null
  const endpoint = body?.endpoint && typeof body.endpoint === 'string' ? body.endpoint : null
  const keys = body?.keys && typeof body.keys === 'object' ? body.keys : null
  const p256dh = keys?.p256dh && typeof keys.p256dh === 'string' ? keys.p256dh : null
  const authKey = keys?.auth && typeof keys.auth === 'string' ? keys.auth : null

  const hasWebPush = !!(endpoint && p256dh && authKey)
  if (!fcmToken && !hasWebPush) {
    return NextResponse.json(
      { error: 'fcmToken or (endpoint and keys.p256dh, keys.auth) required' },
      { status: 400 }
    )
  }

  // Resolve ALL authorized businesses for this user (owner/co-owner/staff) so one enable covers all.
  const authorizedSiteIds = await resolveAuthorizedTenantSiteIds(userId, emailLower)
  const siteIds = [...new Set([authResult.tenantId, ...authorizedSiteIds].filter(Boolean))]

  // ── 1. Save to central userPushSubscription table (primary, same as Customer) ──
  await upsertUserPushSubscription({
    clerkUserId: userId,
    roleContext: 'tenant',
    siteIds,
    fcmToken: fcmToken || null,
    webPush: hasWebPush ? { endpoint: endpoint!, p256dh: p256dh!, auth: authKey! } : null,
  }).catch((e) => console.warn('[push-subscription] central upsert failed', e))

  // ── 2. Also write to legacy tenant / tenantStaff document (backward compat) ──
  if (authResult.isOwner) {
    const ownedTenants = await writeClient.fetch<Array<{ _id: string; fcmToken?: string; fcmTokens?: string[] }>>(
      `*[_type == "tenant" && _id in $siteIds]{ _id, fcmToken, fcmTokens }`,
      { siteIds }
    )
    for (const tenant of ownedTenants ?? []) {
      const patch = writeClient.patch(tenant._id)
      if (fcmToken) {
        const existing = (tenant.fcmTokens ?? []).concat(tenant.fcmToken ? [tenant.fcmToken] : [])
        const nextTokens = [...new Set([...existing, fcmToken])].filter(Boolean)
        patch.set({ fcmTokens: nextTokens })
        if (tenant.fcmToken) patch.unset(['fcmToken'])
      }
      if (hasWebPush) {
        patch.set({ pushSubscription: { endpoint: endpoint!, p256dh: p256dh!, auth: authKey! } })
      }
      await patch.commit().catch((e) => console.warn('[push-subscription] legacy tenant patch failed', e))
    }
    return NextResponse.json({ success: true, siteCount: siteIds.length })
  }

  // Staff path
  if (!emailLower) return NextResponse.json({ error: 'Email required for staff push' }, { status: 400 })

  const staffDocs = await writeClient.fetch<Array<{ _id: string; fcmTokens?: string[] }>>(
    `*[_type == "tenantStaff" && (
      clerkUserId == $userId ||
      (defined(email) && lower(email) == $emailLower)
    ) && site._ref in $siteIds]{ _id, fcmTokens }`,
    { userId, emailLower, siteIds }
  )
  if (!staffDocs?.length) return NextResponse.json({ error: 'Staff record not found' }, { status: 404 })

  for (const staff of staffDocs) {
    const patch = writeClient.patch(staff._id)
    // Save clerkUserId on tenantStaff so sendTenantAndStaffPush can look up central subscriptions
    patch.set({ clerkUserId: userId })
    if (fcmToken) {
      const existing = staff.fcmTokens ?? []
      const nextTokens = [...new Set([...existing, fcmToken])].filter(Boolean)
      patch.set({ fcmTokens: nextTokens })
    }
    if (hasWebPush) {
      patch.set({ pushSubscription: { endpoint: endpoint!, p256dh: p256dh!, auth: authKey! } })
    }
    await patch.commit().catch((e) => console.warn('[push-subscription] legacy staff patch failed', e))
  }

  return NextResponse.json({ success: true, siteCount: siteIds.length })
}
