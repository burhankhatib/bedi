import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { client } from '@/sanity/lib/client'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const tenants = await client.fetch<{ country?: string, city?: string }[]>(
      `*[_type == "tenant" && defined(country) && defined(city)] { country, city }`
    )

    const countries = Array.from(new Set(tenants.map(t => t.country?.trim().toLowerCase()).filter(Boolean)))
    const cities = Array.from(new Set(tenants.map(t => t.city?.trim().toLowerCase()).filter(Boolean)))

      const formatProper = (s: string) => {
        // preserve uppercase like IL or PS, otherwise capitalize first letter
        if (s.length <= 2) return s.toUpperCase()
        return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      }

    return NextResponse.json({
      countries: countries.map(c => typeof c === 'string' ? formatProper(c) : ''),
      cities: cities.map(c => typeof c === 'string' ? formatProper(c) : '')
    })
  } catch (error: any) {
    console.error('[Admin Broadcast Locations]', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
