import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { requirePermission } from '@/lib/staff-permissions'

const noCacheClient = client.withConfig({ useCdn: false })

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const tenantAuth = await checkTenantAuth(slug)
  if (!tenantAuth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: tenantAuth.status })

  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const email = (await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null) || '').trim().toLowerCase()

  const canManage = requirePermission(tenantAuth, 'staff_manage')
  const mineOnly = !canManage || req.nextUrl.searchParams.get('mine') === '1'
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || '40')))

  const sessions = await noCacheClient.fetch<
    Array<{
      _id: string
      actorEmail?: string
      actorRole?: string
      status?: string
      clockInAt?: string
      clockOutAt?: string
      totalMinutes?: number
      clockOutMethod?: string
      staffId?: string
      staffName?: string
      staffEmail?: string
    }>
  >(
    `*[
      _type == "staffAttendanceSession" &&
      site._ref == $tenantId &&
      ($mineOnly == false || lower(actorEmail) == $email)
    ] | order(clockInAt desc)[0...$limit]{
      _id,
      actorEmail,
      actorRole,
      status,
      clockInAt,
      clockOutAt,
      totalMinutes,
      clockOutMethod,
      "staffId": staff._ref,
      "staffName": staff->displayName,
      "staffEmail": staff->email
    }`,
    {
      tenantId: tenantAuth.tenantId,
      mineOnly,
      email,
      limit,
    }
  )

  return NextResponse.json({
    success: true,
    mineOnly,
    sessions: sessions ?? [],
  })
}

