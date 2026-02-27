import { NextRequest, NextResponse } from 'next/server'

/**
 * Returns the client's country based on IP (X-Forwarded-For / X-Real-IP).
 * Uses ip-api.com (free, no key). For local/dev, IP may be private and return nothing.
 */
export async function GET(req: NextRequest) {
  try {
    const forwarded = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const clientIp = forwarded?.split(',')[0]?.trim() || realIp || null

    if (!clientIp || clientIp === '::1' || clientIp.startsWith('127.')) {
      return NextResponse.json({ countryCode: null, countryName: null })
    }

    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(clientIp)}?fields=status,country,countryCode`,
      { next: { revalidate: 0 } }
    )
    const data = (await res.json()) as { status?: string; country?: string; countryCode?: string }
    if (data.status !== 'success') {
      return NextResponse.json({ countryCode: null, countryName: null })
    }
    return NextResponse.json({
      countryCode: data.countryCode || null,
      countryName: data.country || null,
    })
  } catch {
    return NextResponse.json({ countryCode: null, countryName: null })
  }
}
