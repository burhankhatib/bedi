import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendAdminNotification } from '@/lib/admin-push'

const RESEND_API = 'https://api.resend.com/emails'
const TO_EMAIL = 'burhank@gmail.com'
const FROM_EMAIL = 'Bedi Delivery <blocked@bedi.delivery>'

export const dynamic = 'force-dynamic'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST: Save contact from suspended user (Sanity) and optionally email. Body: { type, name, email, message, clerkUserId? } */
export async function POST(req: NextRequest) {
  let body: { type?: string; name?: string; email?: string; message?: string; clerkUserId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const type = (body.type === 'business' || body.type === 'driver' || body.type === 'customer') ? body.type : 'business'
  const name = String(body.name ?? '').trim().slice(0, 200)
  const email = String(body.email ?? '').trim().slice(0, 320)
  const message = String(body.message ?? '').trim().slice(0, 2000)
  const clerkUserId = typeof body.clerkUserId === 'string' ? body.clerkUserId.trim().slice(0, 200) : undefined

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  if (!token) {
    return NextResponse.json({ error: 'Contact form is not configured.' }, { status: 503 })
  }

  try {
    const doc = await writeClient.create({
      _type: 'suspendedContact',
      type,
      ...(clerkUserId ? { clerkUserId } : {}),
      name: name || undefined,
      email,
      message: message || undefined,
      createdAt: new Date().toISOString(),
    })
    if (!doc?._id) {
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }
    const typeLabel = { business: 'Business', driver: 'Driver', customer: 'Customer' }[type]
    await sendAdminNotification(
      `Suspended ${typeLabel} Contact`,
      `${name || email} (${email}) sent a message about their suspended account.`,
      '/admin/reports'
    )
  } catch (e) {
    console.error('[suspended-contact] Sanity create failed:', e)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    const typeLabel = { business: 'Business', driver: 'Driver', customer: 'Customer' }[type]
    const subject = `[Suspended ${typeLabel}] Contact request from ${name || email}`
    const html = `
      <h2>Contact request from suspended ${typeLabel}</h2>
      <p><strong>Type:</strong> ${typeLabel}</p>
      <p><strong>Name:</strong> ${name || '—'}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${(message || 'No message provided.').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>
      <p><em>Sent from the suspended account contact form. Also saved in Reports dashboard.</em></p>
    `
    try {
      const res = await fetch(RESEND_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [TO_EMAIL],
          reply_to: email,
          subject,
          html,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('[suspended-contact] Resend error:', res.status, err)
      }
    } catch (e) {
      console.error('[suspended-contact] Resend failed:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
