import { NextRequest, NextResponse } from 'next/server'

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = 'Bedi Delivery <contact@bedi.delivery>'
const TO_EMAIL = 'burhank@gmail.com'
const SUBJECT = 'Bedi contact us form'

export const dynamic = 'force-dynamic'

type ContactType = 'customer' | 'driver' | 'business'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** POST: Send contact form email via Resend. Body: name, phone, city, country, type (customer|driver|business), businessName? (if type=business), message */
export async function POST(req: NextRequest) {
  let body: {
    name?: string
    phone?: string
    city?: string
    country?: string
    type?: string
    businessName?: string
    message?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim().slice(0, 200)
  const phone = String(body.phone ?? '').trim().slice(0, 50)
  const city = String(body.city ?? '').trim().slice(0, 120)
  const country = String(body.country ?? '').trim().slice(0, 120)
  const type = (body.type === 'customer' || body.type === 'driver' || body.type === 'business')
    ? (body.type as ContactType)
    : 'customer'
  const businessName = type === 'business' ? String(body.businessName ?? '').trim().slice(0, 200) : ''
  const message = String(body.message ?? '').trim().slice(0, 5000)

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!phone) {
    return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[contact] RESEND_API_KEY not set')
    return NextResponse.json({ error: 'Contact form is not configured' }, { status: 503 })
  }

  const typeLabel = { customer: 'Customer', driver: 'Driver', business: 'Business' }[type]
  const html = `
    <h2>Bedi contact us form</h2>
    <p><strong>Type:</strong> ${escapeHtml(typeLabel)}</p>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Mobile / Primary phone:</strong> ${escapeHtml(phone)}</p>
    <p><strong>City:</strong> ${escapeHtml(city) || '—'}</p>
    <p><strong>Country:</strong> ${escapeHtml(country) || '—'}</p>
    ${type === 'business' && businessName ? `<p><strong>Business name:</strong> ${escapeHtml(businessName)}</p>` : ''}
    <h3>Message</h3>
    <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
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
        subject: SUBJECT,
        html,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[contact] Resend error:', res.status, err)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[contact] Failed to send:', e)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
