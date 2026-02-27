import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { token } from '@/sanity/lib/token'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/** PATCH: Update delivery area name_en / name_ar (super admin only). Body: { name_en?: string, name_ar?: string } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let body: { name_en?: string; name_ar?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name_en = typeof body.name_en === 'string' ? body.name_en.trim() : undefined
  const name_ar = typeof body.name_ar === 'string' ? body.name_ar.trim() : undefined
  if (!name_en && !name_ar) {
    return NextResponse.json({ error: 'Provide at least one of name_en or name_ar' }, { status: 400 })
  }

  const existing = await writeClient.fetch<{ _id: string; name_en: string; name_ar: string } | null>(
    `*[_type == "area" && _id == $id][0]{ _id, name_en, name_ar }`,
    { id }
  )
  if (!existing) return NextResponse.json({ error: 'Area not found' }, { status: 404 })

  const updates: { name_en?: string; name_ar?: string } = {}
  if (name_en !== undefined) updates.name_en = name_en
  if (name_ar !== undefined) updates.name_ar = name_ar

  await writeClient.patch(id).set(updates).commit()

  return NextResponse.json({
    ok: true,
    _id: id,
    name_en: updates.name_en ?? existing.name_en,
    name_ar: updates.name_ar ?? existing.name_ar,
  })
}
