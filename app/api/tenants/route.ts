import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { TENANTS_FOR_USER_QUERY } from '@/sanity/lib/queries'
import { getDriverIdByClerkUserId } from '@/lib/driver'
import { slugify, ensureUniqueSlug } from '@/lib/slugify'
import { getPlatformUser } from '@/lib/platform-user'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { normalizePhoneDigits } from '@/lib/order-auth'

/** Normalize phone to digits (e.g. 972501234567) for storage and order matching. */
function normalizeOwnerPhone(phone: string): string {
  let digits = normalizePhoneDigits(phone)
  if (digits.startsWith('0') && digits.length === 10) digits = '972' + digits.slice(1)
  return digits
}

const writeClient = client.withConfig({
  token: token || undefined,
  useCdn: false,
})

/** POST: Create a new tenant (after sign-up). Requires Clerk auth. Driver-only accounts cannot create a business. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let email = ''
    try {
      email = await getEmailForUser(userId, (await auth()).sessionClaims as Record<string, unknown> | null)
    } catch {
      // ignore
    }
    const clerkUserEmailLower = (email || '').trim().toLowerCase()
    const [rawTenants, driverId] = await Promise.all([
      clientNoCdn.fetch<unknown[] | null>(TENANTS_FOR_USER_QUERY, {
        clerkUserId: userId,
        clerkUserEmailLower: clerkUserEmailLower || undefined,
      }),
      getDriverIdByClerkUserId(userId),
    ])
    const hasTenants = Array.isArray(rawTenants) && rawTenants.length > 0
    if (driverId && !hasTenants) {
      return NextResponse.json(
        { error: 'Driver accounts cannot create a business. Use the driver dashboard only.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, slug: rawSlug, businessType, businessSubcategoryIds, ownerPhone: ownerPhoneRaw } = body as {
      name?: string
      slug?: string
      businessType?: string
      businessSubcategoryIds?: string[]
      ownerPhone?: string
    }

    if (!name || !businessType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, businessType' },
        { status: 400 }
      )
    }
    const ownerPhoneTrimmed = typeof ownerPhoneRaw === 'string' ? ownerPhoneRaw.trim() : ''
    if (!ownerPhoneTrimmed) {
      return NextResponse.json(
        { error: 'Owner phone (mobile / WhatsApp) is required. Add your number so you can place orders from the system.' },
        { status: 400 }
      )
    }
    const normalizedOwnerPhone = normalizeOwnerPhone(ownerPhoneTrimmed)
    if (!normalizedOwnerPhone) {
      return NextResponse.json(
        { error: 'Invalid phone number. Use digits with country code (e.g. +972501234567).' },
        { status: 400 }
      )
    }

    // Slug: normalize with slugify and ensure globally unique
    const baseSlug = slugify(typeof rawSlug === 'string' && rawSlug.trim() ? rawSlug : name)
    if (!baseSlug) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
    }
    const slug = await ensureUniqueSlug(baseSlug, async (s) => {
      const existing = await client.fetch<{ _id: string } | null>(
        `*[_type == "tenant" && slug.current == $slug][0]{ _id }`,
        { slug: s }
      )
      return !!existing
    })

    if (!token) {
      return NextResponse.json(
        { error: 'Server misconfiguration: SANITY_API_TOKEN required to create tenants' },
        { status: 500 }
      )
    }

    const authUser = await auth()
    let ownerEmail = ''
    try {
      ownerEmail = await getEmailForUser(userId, authUser.sessionClaims as Record<string, unknown> | null)
    } catch {
      ownerEmail = (authUser.sessionClaims?.email as string) || ''
    }
    const clerkUserEmail = typeof ownerEmail === 'string' && ownerEmail.trim() ? ownerEmail.trim().toLowerCase() : undefined

    const createdAt = new Date().toISOString()
    const doc = await writeClient.create({
      _type: 'tenant',
      slug: { _type: 'slug', current: slug },
      name: name.trim(),
      businessType,
      ...(Array.isArray(businessSubcategoryIds) && businessSubcategoryIds.length > 0
        ? {
            businessSubcategories: businessSubcategoryIds
              .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
              .map((id, i) => ({ _type: 'reference' as const, _key: `sub-${i}`, _ref: id.trim() })),
          }
        : {}),
      clerkUserId: userId,
      ...(clerkUserEmail ? { clerkUserEmail } : {}),
      ownerPhone: ownerPhoneTrimmed,
      normalizedOwnerPhone,
      subscriptionStatus: 'trial',
      createdAt,
    })

    // Upsert platformUser: creating a business makes this a tenant-only account
    try {
      const existing = await getPlatformUser(userId)
      if (existing) {
        await writeClient.patch(existing._id).set({ isTenant: true, accountType: 'tenant' }).commit()
      } else {
        await writeClient.create({
          _type: 'platformUser',
          clerkUserId: userId,
          accountType: 'tenant',
          isTenant: true,
          isDriver: false,
        })
      }
    } catch (e) {
      console.warn('[API] platformUser upsert after tenant create:', e)
    }

    return NextResponse.json({
      success: true,
      tenant: {
        _id: doc._id,
        slug,
        name: doc.name,
        businessType: doc.businessType,
      },
    })
  } catch (error) {
    console.error('[API] Create tenant error:', error)
    return NextResponse.json(
      { error: 'Failed to create tenant' },
      { status: 500 }
    )
  }
}

/** GET: List tenants for the current user (or all for super admin) */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionClaims = (await auth()).sessionClaims as Record<string, unknown> | null
    let email = ''
    try {
      email = await getEmailForUser(userId, sessionClaims)
    } catch {
      email = (sessionClaims?.email as string) ?? ''
    }
    const isSuperAdmin = email === 'burhank@gmail.com'

    if (isSuperAdmin) {
      const list = await client.fetch<
        Array<{ _id: string; slug: { current: string }; name: string; businessType: string; clerkUserEmail?: string; subscriptionStatus: string }>
      >(
        `*[_type == "tenant"] | order(createdAt desc) { _id, slug, name, businessType, clerkUserEmail, subscriptionStatus }`
      )
      const tenants = (list || []).map((t) => {
        const slugVal = t.slug
        const slugStr = typeof slugVal === 'object' && slugVal && 'current' in slugVal ? slugVal.current : String(slugVal ?? '')
        return {
          _id: t._id,
          slug: slugStr,
          name: t.name,
          businessType: t.businessType,
          clerkUserEmail: t.clerkUserEmail,
          subscriptionStatus: t.subscriptionStatus,
        }
      })
      return NextResponse.json({ tenants, superAdmin: true })
    }

    const clerkUserEmailLower = (email || '').trim().toLowerCase()
    const list = await clientNoCdn.fetch<
      Array<{ _id: string; slug: { current: string }; name: string; businessType: string; subscriptionStatus: string }>
    >(
      // Same as TENANTS_FOR_USER_QUERY: by userId or by owner / co-owner email
      `*[_type == "tenant" && (
        clerkUserId == $userId ||
        (defined($clerkUserEmailLower) && $clerkUserEmailLower != "" && (
          (defined(clerkUserEmail) && lower(clerkUserEmail) == $clerkUserEmailLower) ||
          (defined(coOwnerEmails) && $clerkUserEmailLower in coOwnerEmails)
        ))
      )] | order(createdAt desc) { _id, slug, name, businessType, subscriptionStatus }`,
      { userId, clerkUserEmailLower: clerkUserEmailLower || undefined }
    )
    const tenants = (list || []).map((t) => {
      const slugVal = t.slug
      const slugStr = typeof slugVal === 'object' && slugVal && 'current' in slugVal ? slugVal.current : String(slugVal ?? '')
      return {
        _id: t._id,
        slug: slugStr,
        name: t.name,
        businessType: t.businessType,
        subscriptionStatus: t.subscriptionStatus,
      }
    })
    return NextResponse.json({ tenants })
  } catch (error) {
    console.error('[API] List tenants error:', error)
    return NextResponse.json(
      { error: 'Failed to list tenants' },
      { status: 500 }
    )
  }
}
