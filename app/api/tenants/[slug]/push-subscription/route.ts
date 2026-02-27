import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { auth } from '@clerk/nextjs/server'
import { requirePermission, ORDERS_PERMISSION } from '@/lib/staff-permissions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** CRITICAL: Push subscription for new-order notifications. Owner: saved on tenant. Staff: saved on tenantStaff. */

/** GET - Whether this user (owner or staff) has push enabled for this tenant. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const authResult = await checkTenantAuth(slug)
  if (!authResult.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (authResult.isOwner) {
    const tenant = await client.fetch<{ fcmToken?: string; fcmTokens?: string[]; pushSubscription?: { endpoint?: string } } | null>(
      `*[_type == "tenant" && _id == $tenantId][0]{ fcmToken, fcmTokens, "pushSubscription": pushSubscription }`,
      { tenantId: authResult.tenantId }
    )
    const hasFcm = !!((tenant?.fcmTokens?.length ?? 0) > 0 || tenant?.fcmToken)
    const hasPush = !!(hasFcm || tenant?.pushSubscription?.endpoint)
    return NextResponse.json({ hasPush })
  }

  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  const emailLower = (email || '').trim().toLowerCase()
  const staff = await client.fetch<{ fcmTokens?: string[]; pushSubscription?: { endpoint?: string } } | null>(
    `*[_type == "tenantStaff" && site._ref == $tenantId && lower(email) == $emailLower][0]{ fcmTokens, pushSubscription }`,
    { tenantId: authResult.tenantId, emailLower }
  )
  const hasFcm = !!((staff?.fcmTokens?.length ?? 0) > 0)
  const hasPush = !!(hasFcm || staff?.pushSubscription?.endpoint)
  return NextResponse.json({ hasPush })
}

/** POST - Save push subscription. Owner: saved on tenant. Staff: saved on their tenantStaff doc. Requires orders permission. */
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

  if (authResult.isOwner) {
    const tenant = await writeClient.fetch<{ _id: string; fcmToken?: string; fcmTokens?: string[] } | null>(
      `*[_type == "tenant" && _id == $tenantId][0]{ _id, fcmToken, fcmTokens }`,
      { tenantId: authResult.tenantId }
    )
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const patch = writeClient.patch(tenant._id)
    if (fcmToken) {
      const existing = (tenant.fcmTokens ?? []).concat(tenant.fcmToken ? [tenant.fcmToken] : [])
      const nextTokens = [...new Set([...existing, fcmToken])].filter(Boolean)
      patch.set({ fcmTokens: nextTokens })
      if (tenant.fcmToken) patch.unset(['fcmToken'])
    }
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
    return NextResponse.json({ success: true })
  }

  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  const emailLower = (email || '').trim().toLowerCase()
  if (!emailLower) return NextResponse.json({ error: 'Email required for staff push' }, { status: 400 })

  const staff = await writeClient.fetch<{ _id: string; fcmTokens?: string[]; pushSubscription?: { endpoint?: string } } | null>(
    `*[_type == "tenantStaff" && site._ref == $tenantId && lower(email) == $emailLower][0]{ _id, fcmTokens, pushSubscription }`,
    { tenantId: authResult.tenantId, emailLower }
  )
  if (!staff) return NextResponse.json({ error: 'Staff record not found' }, { status: 404 })

  const patch = writeClient.patch(staff._id)
  if (fcmToken) {
    const existing = staff.fcmTokens ?? []
    const nextTokens = [...new Set([...existing, fcmToken])].filter(Boolean)
    patch.set({ fcmTokens: nextTokens })
  }
  if (hasWebPush) {
    patch.set({
      pushSubscription: { endpoint: endpoint!, p256dh: p256dh!, auth: authKey! },
    })
  }
  await patch.commit()
  return NextResponse.json({ success: true })
}
