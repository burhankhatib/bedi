import { NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { clerkClient } from '@clerk/nextjs/server'

type NativeGoogleTicketBody = {
  idToken?: string
  mode?: 'sign-in' | 'sign-up'
}

type GoogleTokenPayload = {
  email?: string
  email_verified?: boolean
  given_name?: string
  family_name?: string
  sub?: string
}

const googleClient = new OAuth2Client()

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NativeGoogleTicketBody
    const idToken = body.idToken?.trim()
    const mode = body.mode === 'sign-up' ? 'sign-up' : 'sign-in'

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    }

    const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim()
    if (!webClientId) {
      return NextResponse.json({ error: 'Server missing Google client id' }, { status: 500 })
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: webClientId,
    })
    const payload = (ticket.getPayload() || {}) as GoogleTokenPayload

    const email = payload.email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Google token missing email' }, { status: 400 })
    }
    if (!payload.email_verified) {
      return NextResponse.json({ error: 'Google email is not verified' }, { status: 400 })
    }

    const clerk = await clerkClient()
    const { data } = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 1,
    })

    let user = data?.[0]
    if (!user) {
      if (mode === 'sign-in') {
        return NextResponse.json({ error: 'No account found for this Google email' }, { status: 404 })
      }

      user = await clerk.users.createUser({
        emailAddress: [email],
        firstName: payload.given_name || undefined,
        lastName: payload.family_name || undefined,
        externalId: payload.sub ? `google:${payload.sub}` : undefined,
        skipPasswordRequirement: true,
      })
    }

    const signInToken = await clerk.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: 60,
    })

    return NextResponse.json({ ticket: signInToken.token })
  } catch (error) {
    console.error('[native-google-ticket] Failed to create Clerk ticket:', error)
    return NextResponse.json({ error: 'Failed to complete native Google login' }, { status: 500 })
  }
}
