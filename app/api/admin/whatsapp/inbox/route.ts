import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { client } from '@/sanity/lib/client'

type WhatsAppMessage = {
  _id: string
  participantPhone: string
  direction: 'in' | 'out'
  text?: string
  messageType?: string
  createdAt?: string
}

export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const messages = await client.fetch<WhatsAppMessage[]>(
    `*[_type == "whatsappMessage"] | order(createdAt asc) {
      _id,
      participantPhone,
      direction,
      text,
      messageType,
      createdAt
    }`
  )

  const byPhone = new Map<string, WhatsAppMessage[]>()
  for (const m of messages) {
    const phone = m.participantPhone || 'unknown'
    if (!byPhone.has(phone)) byPhone.set(phone, [])
    byPhone.get(phone)!.push(m)
  }

  const conversations = Array.from(byPhone.entries())
    .map(([phone, msgs]) => {
      const sorted = [...msgs].sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
      )
      const last = sorted[sorted.length - 1]
      return {
        participantPhone: phone,
        lastMessageAt: last?.createdAt,
        lastMessagePreview: last?.text?.substring(0, 60) ?? '',
        messageCount: sorted.length,
        messages: sorted,
      }
    })
    .sort((a, b) => {
      const da = new Date(a.lastMessageAt ?? 0).getTime()
      const db = new Date(b.lastMessageAt ?? 0).getTime()
      return db - da
    })

  return NextResponse.json({ conversations })
}
