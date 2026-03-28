'use client'

/**
 * Native Google Sign-In using @capgo/capacitor-social-login + Clerk's `google_one_tap`.
 * 
 * We must use this native flow because opening Clerk's web OAuth URL in `InAppBrowser` 
 * fails with `authorization_invalid` (the Custom Tab lacks the app's webview cookies).
 * 
 * IMPORTANT: To prevent "You are not authorized to perform this request" here:
 * 1. Go to Clerk Dashboard -> User & Authentication -> Social Connections
 * 2. Click "Add connection" and choose **Google One Tap** (it is a separate connection from "Google"!)
 * 3. Turn ON "Use custom credentials"
 * 4. Paste your WEB Client ID (`162296...qkhp...apps.googleusercontent.com`)
 * 5. Paste your Client Secret
 * 6. Save!
 */

import { useCallback } from 'react'
import { useClerk } from '@clerk/nextjs'
import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { useRouter } from 'next/navigation'
import { getAllowedRedirectPath } from '@/lib/auth-utils'
import { storeOAuthReturnTo } from '@/lib/capacitor-native-oauth'

let socialLoginInitialized = false

export function useGoogleOAuthCapacitor(mode: 'sign-in' | 'sign-up') {
  const clerk = useClerk()
  const router = useRouter()

  const isLoaded = clerk.loaded

  const startOAuth = useCallback(
    async (opts?: { redirectUrl?: string | null }) => {
      if (!Capacitor.isNativePlatform()) {
        throw new Error('useGoogleOAuthCapacitor is only for native Capacitor')
      }
      if (!clerk.loaded) throw new Error('Clerk not ready')

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

        const idToken = res.result.idToken
        if (!idToken) {
          throw new Error('No ID token received from Google')
        }

        const dest = getAllowedRedirectPath(opts?.redirectUrl ?? null, '/')
        storeOAuthReturnTo(dest)

        // Clerk's unified Google One Tap method
        const attempt = await clerk.authenticateWithGoogleOneTap({
          token: idToken,
        })

        if (attempt.status === 'complete') {
          await clerk.setActive({ session: attempt.createdSessionId })
          router.push(dest)
        } else if (attempt.status === 'needs_second_factor') {
          router.push('/verify-phone')
        } else {
          console.warn('Unhandled One Tap status:', attempt.status)
        }
      } catch (err: any) {
        console.error('Native Google OAuth Error:', err)
        throw err
      }
    },
    [clerk, router]
  )

  return { isLoaded, startOAuth }
}
