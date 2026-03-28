'use client'

/**
 * Clerk does not ship `useOAuth` in `@clerk/nextjs` v6. This hook mirrors the typical
 * `useOAuth({ strategy: 'oauth_google' })` shape for Capacitor: `startOAuth` builds the
 * Clerk OAuth URL via `signIn` / `signUp` and opens the system browser.
 *
 * Prefer {@link GoogleLoginButton} unless you need a fully custom UI.
 */

import { useCallback } from 'react'
import { useSignIn, useSignUp, useClerk } from '@clerk/nextjs'
import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { getAllowedRedirectPath } from '@/lib/auth-utils'

export function useGoogleOAuthCapacitor(mode: 'sign-in' | 'sign-up') {
  const { isLoaded: signInLoaded, signIn } = useSignIn()
  const { isLoaded: signUpLoaded, signUp } = useSignUp()
  const { setActive } = useClerk()

  const isLoaded = mode === 'sign-in' ? signInLoaded : signUpLoaded

  const startOAuth = useCallback(
    async (opts?: { redirectUrl?: string | null }) => {
      if (!Capacitor.isNativePlatform()) {
        throw new Error('useGoogleOAuthCapacitor is only for native Capacitor')
      }
      if (mode === 'sign-in' && !signIn) throw new Error('Clerk sign-in not ready')
      if (mode === 'sign-up' && !signUp) throw new Error('Clerk sign-up not ready')

      const dest = getAllowedRedirectPath(opts?.redirectUrl ?? null, '/')

      // 1. Initialize Plugin
      await SocialLogin.initialize({
        google: {
          webClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          iOSClientId: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        },
      })

      // 2. Open Native Google Account Picker
      const res = await SocialLogin.login({
        provider: 'google',
        options: {
          scopes: ['email', 'profile'],
        },
      })

      const idToken = (res.result as any).idToken
      if (!idToken) throw new Error('No ID token returned from Google native login')

      // 3. Authenticate with Clerk using the Google ID Token
      try {
        const result = await signIn!.create({
          strategy: 'google_one_tap' as any,
          token: idToken,
        })

        if (result.status === 'complete') {
          await setActive({ session: result.createdSessionId })
          window.location.href = dest
        } else {
          console.warn('Sign in not complete', result)
        }
      } catch (error: any) {
        // If the user doesn't exist yet, we catch the error and sign them up instead
        if (error?.errors?.[0]?.code === 'form_identifier_not_found') {
          const signUpResult = await signUp!.create({
            strategy: 'google_one_tap' as any,
            token: idToken,
          })
          if (signUpResult.status === 'complete') {
            await setActive({ session: signUpResult.createdSessionId })
            window.location.href = dest
          } else {
            console.warn('Sign up not complete', signUpResult)
          }
        } else {
          throw error
        }
      }
    },
    [mode, signIn, signUp, setActive]
  )

  return { isLoaded, startOAuth }
}
