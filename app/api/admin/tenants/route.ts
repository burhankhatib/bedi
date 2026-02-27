import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { slugify, ensureUniqueSlug } from '@/lib/slugify'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/** POST: Create a new business (tenant) as super admin. You own it until you transfer it. Body: { name, slug?, businessType } */
export async function POST(req: NextRequest) {
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
  const clerkUserEmail = typeof ownerEmail === 'string' && ownerEmail.trim() ? ownerEmail.trim().toLowerCase() : undefined

  if (!token) {
    return NextResponse.json(
      { error: 'Server misconfiguration: SANITY_API_TOKEN required' },
      { status: 500 }
    )
  }

  let body: { name?: string; slug?: string; businessType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const businessType = typeof body.businessType === 'string' ? body.businessType.trim() : ''
  if (!name || !businessType) {
    return NextResponse.json(
      { error: 'Missing required fields: name, businessType' },
      { status: 400 }
    )
  }

  const baseSlug = slugify(
    typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : name
  )
  if (!baseSlug) {
    return NextResponse.json({ error: 'Invalid name or slug' }, { status: 400 })
  }

  const slug = await ensureUniqueSlug(baseSlug, async (s) => {
    const existing = await client.fetch<{ _id: string } | null>(
      `*[_type == "tenant" && slug.current == $slug][0]{ _id }`,
      { slug: s }
    )
    return !!existing
  })

  const createdAt = new Date().toISOString()
  // Trial: 30 days from tenant site creation (same as main tenant creation).
  const subscriptionExpiresAt = new Date(new Date(createdAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const doc = await writeClient.create({
    _type: 'tenant',
    slug: { _type: 'slug', current: slug },
    name,
    businessType,
    clerkUserId: userId,
    ...(clerkUserEmail ? { clerkUserEmail } : {}),
    subscriptionStatus: 'trial',
    createdAt,
    subscriptionExpiresAt,
  })

  return NextResponse.json({
    success: true,
    tenant: {
      _id: doc._id,
      slug,
      name: doc.name,
      businessType: doc.businessType,
    },
  })
}
