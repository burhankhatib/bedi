'use client'

/**
 * Browser-based OAuth via Clerk `signIn` / `signUp` + `strategy: 'oauth_google'`.
 *
 * Opens the system browser (Custom Tabs / SFSafariViewController) for the OAuth flow.
 * After Google + Clerk finish they redirect back to `<appId>://oauth-callback`; the OS
 * re-opens the app and CapacitorAppUrlListener completes the session.
 *
 * This avoids the SHA-256 / Native-API attestation requirement of the ID-token path
 * and is the standard Capacitor + Clerk approach.
 *
 * Prefer {@link GoogleLoginButton} unless you need a fully custom UI.
 */

import { useCallback } from 'react'
import { useSignIn, useSignUp } from '@clerk/nextjs'
import { Capacitor } from '@capacitor/core'
import { InAppBrowser, DefaultSystemBrowserOptions } from '@capacitor/inappbrowser'
import { resolveNativeOAuthRedirectUrl, storeOAuthReturnTo } from '@/lib/capacitor-native-oauth'
import { getAllowedRedirectPath } from '@/lib/auth-utils'

export function useGoogleOAuthCapacitor(mode: 'sign-in' | 'sign-up') {
  const { isLoaded: signInLoaded, signIn } = useSignIn()
  const { isLoaded: signUpLoaded, signUp } = useSignUp()

  const isLoaded = mode === 'sign-in' ? signInLoaded : signUpLoaded

  const startOAuth = useCallback(
    async (opts?: { redirectUrl?: string | null }) => {
      if (!Capacitor.isNativePlatform()) {
        throw new Error('useGoogleOAuthCapacitor is only for native Capacitor')
      }
      if (mode === 'sign-in' && !signIn) throw new Error('Clerk sign-in not ready')
      if (mode === 'sign-up' && !signUp) throw new Error('Clerk sign-up not ready')

      const dest = getAllowedRedirectPath(opts?.redirectUrl ?? null, '/')
      storeOAuthReturnTo(dest)
      const nativeRedirect = await resolveNativeOAuthRedirectUrl()

      if (mode === 'sign-in') {
        const res = await signIn!.create({
          strategy: 'oauth_google',
          redirectUrl: nativeRedirect,
        })
        const authUrl = res.firstFactorVerification.externalVerificationRedirectURL?.href
        if (!authUrl) throw new Error('No OAuth URL from Clerk')
        await InAppBrowser.openInSystemBrowser({ url: authUrl, options: DefaultSystemBrowserOptions })
        return
      }

      const res = await signUp!.create({
        strategy: 'oauth_google',
        redirectUrl: nativeRedirect,
      })
      const authUrl = res.verifications?.externalAccount?.externalVerificationRedirectURL?.href
      if (!authUrl) throw new Error('No OAuth URL from Clerk')
      await InAppBrowser.openInSystemBrowser({ url: authUrl, options: DefaultSystemBrowserOptions })
    },
    [mode, signIn, signUp]
  )

  return { isLoaded, startOAuth }
}
