import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = client.withConfig({ token, useCdn: false })

const SUBSCRIPTION_PLANS = ['basic', 'pro', 'ultra'] as const

function isValidPlan(v: unknown): v is (typeof SUBSCRIPTION_PLANS)[number] {
  return typeof v === 'string' && (SUBSCRIPTION_PLANS as readonly string[]).includes(v)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let ownerEmail = ''
  try {
    ownerEmail = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  } catch {
    ownerEmail = (sessionClaims?.email as string) || ''
  }
  if (!isSuperAdminEmail(ownerEmail)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { subscriptionExpiresAt, subscriptionStatus, subscriptionPlan } = body as {
      subscriptionExpiresAt?: string | null
      subscriptionStatus?: string
      subscriptionPlan?: string
    }

    const updateData: Record<string, unknown> = {}

    if (subscriptionExpiresAt !== undefined) {
      updateData.subscriptionExpiresAt = subscriptionExpiresAt
    }
    if (subscriptionStatus !== undefined && typeof subscriptionStatus === 'string') {
      updateData.subscriptionStatus = subscriptionStatus
    }
    if (subscriptionPlan !== undefined) {
      if (!isValidPlan(subscriptionPlan)) {
        return NextResponse.json(
          { error: 'Invalid subscriptionPlan; expected basic, pro, or ultra' },
          { status: 400 }
        )
      }
      updateData.subscriptionPlan = subscriptionPlan
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No data to update' }, { status: 400 })
    }

    const updated = await writeClient.patch(id).set(updateData).commit()

    return NextResponse.json({ ok: true, updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Admin] Error updating subscription:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
