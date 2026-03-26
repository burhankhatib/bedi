import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const query = `*[_type == "driver" && isActive == true] | order(name asc) {
      _id,
      name,
      phoneNumber,
      vehicleType,
      isActive,
      deliveryAreas[]->{_id, name_en, name_ar}
    }`
    const result = await client.fetch(query)
    return NextResponse.json(result ?? [])
  } catch (error) {
    console.error('Failed to fetch active drivers:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
