import { NextRequest, NextResponse } from 'next/server'

/**
 * Redirects the old /dashboard/sw.js to the new static /dashboard-sw.js
 */
export async function GET(req: NextRequest) {
  const url = new URL('/dashboard-sw.js', req.url)
  return NextResponse.redirect(url)
}
