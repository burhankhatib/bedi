'use client'

/**
 * Clerk does not ship `useOAuth` in `@clerk/nextjs` v6. This hook mirrors the typical
 * `useOAuth({ strategy: 'oauth_google' })` shape for Capacitor: `startOAuth` builds the
 * Clerk OAuth URL via `signIn` / `signUp` and opens the system browser.
 *
 * Prefer {@link GoogleLoginButton} unless you need a fully custom UI.
 */

import { useCallback } from 'react'
import { useSignIn, useSignUp } from '@clerk/nextjs'
import { Capacitor } from '@capacitor/core'
import { InAppBrowser, DefaultSystemBrowserOptions } from '@capacitor/inappbrowser'
import { resolveNativeOAuthRedirectUrl, storeOAuthReturnTo } from '@/lib/capacitor-native-oauth'
import { getAllowedRedirectPath } from '@/lib/auth-utils'

function shouldSkipLegalAccepted(): boolean {
  return process.env.NEXT_PUBLIC_NATIVE_GOOGLE_SKIP_LEGAL_ACCEPTED === '1'
}

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
      const withLegalAccepted = !shouldSkipLegalAccepted()

      if (mode === 'sign-in') {
        const createPayload: Record<string, unknown> = {
          strategy: 'oauth_google',
          redirectUrl: nativeRedirect,
        }
        if (withLegalAccepted) createPayload.legalAccepted = true

        let res
        try {
          res = await signIn!.create(createPayload as any)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (withLegalAccepted && msg.includes('authorization_invalid')) {
            // Some Clerk instances may reject legalAccepted in this strategy; retry once without it.
            res = await signIn!.create({
              strategy: 'oauth_google',
              redirectUrl: nativeRedirect,
            })
          } else {
            throw error
          }
        }
        const authUrl = res.firstFactorVerification.externalVerificationRedirectURL?.href
        if (!authUrl) throw new Error('No OAuth URL from Clerk')
        await InAppBrowser.openInSystemBrowser({
          url: authUrl,
          options: DefaultSystemBrowserOptions,
        })
        return
      }

      const createPayload: Record<string, unknown> = {
        strategy: 'oauth_google',
        redirectUrl: nativeRedirect,
      }
      if (withLegalAccepted) createPayload.legalAccepted = true

      let res
      try {
        res = await signUp!.create(createPayload as any)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (withLegalAccepted && msg.includes('authorization_invalid')) {
          // Some Clerk instances may reject legalAccepted in this strategy; retry once without it.
          res = await signUp!.create({
            strategy: 'oauth_google',
            redirectUrl: nativeRedirect,
          })
        } else {
          throw error
        }
      }
      const authUrl = res.verifications?.externalAccount?.externalVerificationRedirectURL?.href
      if (!authUrl) throw new Error('No OAuth URL from Clerk')
      await InAppBrowser.openInSystemBrowser({
        url: authUrl,
        options: DefaultSystemBrowserOptions,
      })
    },
    [mode, signIn, signUp]
  )

  return { isLoaded, startOAuth }
}
