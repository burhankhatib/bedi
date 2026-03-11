import { NextRequest, NextResponse } from 'next/server'

/**
 * Redirects the old /driver/sw.js to the new static /driver-sw.js
 */
export async function GET(req: NextRequest) {
  const url = new URL('/driver-sw.js', req.url)
  return NextResponse.redirect(url)
}
