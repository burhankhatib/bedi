'use client'

/**
 * Native Google Sign-In using @capgo/capacitor-social-login.
 *
 * The client gets a Google ID token natively, sends it to our server route, and receives
 * a short-lived Clerk "sign-in ticket". We then complete session creation with
 * `signIn.create({ strategy: 'ticket' })`.
 *
 * This avoids the failing mobile OAuth redirect path that was returning
 * `authorization_invalid` in external browser flows.
 */

import { useCallback } from 'react'
import { useClerk, useSignIn } from '@clerk/nextjs'
import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { useRouter } from 'next/navigation'
import { getAllowedRedirectPath } from '@/lib/auth-utils'
import { storeOAuthReturnTo } from '@/lib/capacitor-native-oauth'

let socialLoginInitialized = false

export function useGoogleOAuthCapacitor(mode: 'sign-in' | 'sign-up') {
  const clerk = useClerk()
  const { signIn, isLoaded: signInLoaded } = useSignIn()
  const router = useRouter()

  const isLoaded = clerk.loaded && signInLoaded

  const startOAuth = useCallback(
    async (opts?: { redirectUrl?: string | null }) => {
      if (!Capacitor.isNativePlatform()) {
        throw new Error('useGoogleOAuthCapacitor is only for native Capacitor')
      }
      if (!clerk.loaded || !signIn) throw new Error('Clerk sign-in not ready')

      try {
        if (!socialLoginInitialized) {
          await SocialLogin.initialize({
            google: {
              // We MUST use the Web Client ID here!
              // Google Play Services uses this to know which backend app the token is for.
              webClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
            },
          })
          socialLoginInitialized = true
        }

        const res = await SocialLogin.login({
          provider: 'google',
          options: {
            scopes: ['email', 'profile'],
          },
        })

        const idToken = 'idToken' in res.result ? res.result.idToken : null
        if (!idToken) {
          throw new Error('No ID token received from Google')
        }

        const dest = getAllowedRedirectPath(opts?.redirectUrl ?? null, '/')
        storeOAuthReturnTo(dest)

        const ticketRes = await fetch('/api/auth/native-google-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idToken,
            mode,
          }),
        })
        const ticketJson = await ticketRes.json().catch(() => ({}))
        if (!ticketRes.ok || !ticketJson?.ticket) {
          throw new Error(ticketJson?.error || 'Failed to create Clerk sign-in ticket')
        }

        const attempt = await signIn.create({
          strategy: 'ticket',
          ticket: ticketJson.ticket,
        })

        if (attempt.status === 'complete') {
          await clerk.setActive({ session: attempt.createdSessionId })
          router.push(dest)
        } else {
          throw new Error(`Unexpected sign-in status: ${attempt.status}`)
        }
      } catch (err: any) {
        console.error('Native Google OAuth Error:', err)
        throw err
      }
    },
    [clerk, mode, router, signIn]
  )

  return { isLoaded, startOAuth }
}
