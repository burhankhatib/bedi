import { NextRequest, NextResponse } from 'next/server'
import { ALLOWED_REGISTRATION_COUNTRY_CODES } from '@/lib/constants'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Country } = require('country-state-city')

/** GET /api/countries — all countries. GET /api/countries?registration=1 — only countries allowed for Tenant/Driver registration (e.g. IL, PS). */
export async function GET(request: NextRequest) {
  try {
    const list = Country.getAllCountries() as Array<{ isoCode: string; name: string }>
    const registrationOnly = request.nextUrl.searchParams.get('registration') === '1'
    let filtered = list ?? []
    if (registrationOnly) {
      const allowedSet = new Set(ALLOWED_REGISTRATION_COUNTRY_CODES)
      filtered = filtered.filter((c) => allowedSet.has(c.isoCode as 'IL' | 'PS'))
    }
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json(sorted.map((c) => ({ code: c.isoCode, name: c.name })))
  } catch (e) {
    console.error('[countries]', e)
    return NextResponse.json([], { status: 500 })
  }
}
