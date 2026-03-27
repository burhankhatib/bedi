import { OAuth2Client } from 'google-auth-library'
import { NextRequest, NextResponse } from 'next/server'

function decodeJwtPayload(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split('.')
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function collectAudiences(): string[] {
  const raw = [
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    ...(process.env.GOOGLE_ANDROID_OAUTH_CLIENT_IDS?.split(',') ?? []),
  ]
  return [...new Set(raw.map((s) => s?.trim()).filter(Boolean) as string[])]
}

/**
 * POST { idToken }
 * Header: x-debug-secret — must match DIAGNOSE_GOOGLE_TOKEN_SECRET.
 *
 * Returns JWT claims (aud, azp, email, …) and optional Google signature verification.
 * Use when Clerk returns authorization_invalid after native Google: aud must match
 * the Web client ID in Clerk → Google SSO (and Native Applications must be registered).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.DIAGNOSE_GOOGLE_TOKEN_SECRET?.trim()
  if (!secret || req.headers.get('x-debug-secret') !== secret) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const idToken =
    typeof body === 'object' &&
    body !== null &&
    'idToken' in body &&
    typeof (body as { idToken: unknown }).idToken === 'string'
      ? (body as { idToken: string }).idToken
      : null

  if (!idToken) {
    return NextResponse.json({ error: 'idToken (string) required' }, { status: 400 })
  }

  const payload = decodeJwtPayload(idToken)
  if (!payload) {
    return NextResponse.json({ error: 'Could not decode JWT payload' }, { status: 400 })
  }

  const audiences = collectAudiences()
  let googleVerification: { ok: true } | { ok: false; message: string } | null = null

  if (audiences.length > 0) {
    const client = new OAuth2Client()
    try {
      await client.verifyIdToken({ idToken, audience: audiences })
      googleVerification = { ok: true }
    } catch (e) {
      googleVerification = {
        ok: false,
        message: e instanceof Error ? e.message : 'verifyIdToken failed',
      }
    }
  }

  return NextResponse.json({
    decoded: {
      aud: payload.aud,
      azp: payload.azp,
      iss: payload.iss,
      email: payload.email,
      exp: payload.exp,
    },
    audiencesUsedForVerification: audiences.length > 0 ? audiences : undefined,
    googleVerification,
    hint:
      'If aud is your Android/iOS OAuth client ID, Clerk still expects the token aud (or azp in some setups) to align with the Web client used in Clerk Google SSO. Register each Android app under Clerk → Native applications (package + SHA-256).',
  })
}
