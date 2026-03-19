import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getOrCreateCustomer } from '@/lib/customer-helpers'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export type CustomerProfileApiCustomer = {
  _id: string
  name?: string | null
  email?: string | null
  primaryPhone?: string | null
  orderCount?: number | null
  firstOrderAt?: string | null
  lastOrderAt?: string | null
  blockedBySuperAdmin?: boolean | null
}

export type CustomerProfileApiClerk = {
  email: string | null
  phone: string | null
  phoneVerified: boolean
  /** Clerk first + last name (fallback for display before Sanity name is set). */
  fullName: string | null
}

/**
 * GET — current user's Sanity customer row + Clerk account hints (email / phone).
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customer = await client.fetch<CustomerProfileApiCustomer | null>(
    `*[_type == "customer" && clerkUserId == $userId][0]{
      _id,
      name,
      email,
      primaryPhone,
      orderCount,
      firstOrderAt,
      lastOrderAt,
      blockedBySuperAdmin
    }`,
    { userId }
  )

  let clerkEmail: string | null = null
  let clerkPhone: string | null = null
  let phoneVerified = false
  let fullName: string | null = null
  try {
    const c = await clerkClient()
    const user = await c.users.getUser(userId)
    fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null
    clerkEmail =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null
    const pid = user.primaryPhoneNumberId
    const ph = user.phoneNumbers.find((p) => p.id === pid)
    if (ph) {
      clerkPhone = ph.phoneNumber
      phoneVerified = ph.verification?.status === 'verified'
    }
  } catch (e) {
    console.warn('[customer/profile GET] Clerk:', e)
  }

  const clerk: CustomerProfileApiClerk = {
    email: clerkEmail,
    phone: clerkPhone,
    phoneVerified,
    fullName,
  }

  return NextResponse.json(
    { customer, clerk },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

/**
 * PATCH — update display name in Sanity + Clerk (first / last name split).
 */
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server configuration' }, { status: 500 })

  let body: { name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name =
    typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: 'Name must be between 1 and 120 characters.' },
      { status: 400 }
    )
  }

  const customerId = await getOrCreateCustomer(userId)
  if (!customerId) {
    return NextResponse.json(
      { error: 'Could not save your profile. Try again later.' },
      { status: 500 }
    )
  }

  try {
    await writeClient.patch(customerId).set({ name }).commit()
  } catch (e) {
    console.error('[customer/profile PATCH] Sanity:', e)
    return NextResponse.json({ error: 'Could not save profile' }, { status: 500 })
  }

  const parts = name.split(' ').filter(Boolean)
  const firstName = parts[0] ?? ''
  const lastName = parts.slice(1).join(' ')

  try {
    const c = await clerkClient()
    await c.users.updateUser(userId, {
      firstName,
      lastName: lastName || '',
    })
  } catch (e) {
    console.warn('[customer/profile PATCH] Clerk update:', e)
  }

  return NextResponse.json({ success: true, name })
}
