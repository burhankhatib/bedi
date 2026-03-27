'use client'

import { useClerk } from '@clerk/nextjs'
import { Capacitor } from '@capacitor/core'
import { getAllowedRedirectPath } from '@/lib/auth-utils'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

let socialLoginInitPromise: Promise<void> | null = null

/** Decode JWT payload (no signature check) to compare `aud` with Clerk’s Google Web client ID. */
function readGoogleIdTokenAud(idToken: string): string | null {
  try {
    const part = idToken.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad = (4 - (base64.length % 4)) % 4
    const binary = atob(base64 + '='.repeat(pad))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { aud?: unknown }
    const { aud } = payload
    if (typeof aud === 'string') return aud
    if (Array.isArray(aud) && typeof aud[0] === 'string') return aud[0]
    return null
  } catch {
    return null
  }
}

async function ensureSocialLoginInitialized(): Promise<void> {
  if (socialLoginInitPromise) return socialLoginInitPromise

  socialLoginInitPromise = (async () => {
    const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim()
    if (!webClientId) {
      throw new Error('NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set')
    }

    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    const platform = Capacitor.getPlatform()

    if (platform === 'ios') {
      const iosClientId = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim()
      if (!iosClientId) {
        throw new Error('NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID is not set (required on iOS)')
      }
      await SocialLogin.initialize({
        google: {
          iOSClientId: iosClientId,
          iOSServerClientId: webClientId,
          mode: 'online',
        },
      })
      return
    }

    await SocialLogin.initialize({
      google: {
        webClientId,
      },
    })
  })()

  return socialLoginInitPromise
}

export type NativeGoogleSignInButtonProps = {
  /** Matches Clerk `<SignIn />` vs `<SignUp />` post-auth redirects */
  mode: 'sign-in' | 'sign-up'
  redirectUrl?: string | null
  className?: string
}

/**
 * Native-only: uses device Google account + ID token, then Clerk's Google One Tap–compatible API.
 * Hidden on web; no-op if env vars are missing.
 */
export function NativeGoogleSignInButton({
  mode,
  redirectUrl,
  className,
}: NativeGoogleSignInButtonProps) {
  const clerk = useClerk()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])

  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim()

  const afterSignInUrl = useCallback(() => {
    const dest = getAllowedRedirectPath(redirectUrl, '/')
    return `/auth/continue?returnTo=${encodeURIComponent(dest)}`
  }, [redirectUrl])

  const afterSignUpUrl = useCallback(() => {
    const dest = getAllowedRedirectPath(redirectUrl, '/')
    return `/verify-phone?returnTo=${encodeURIComponent(dest)}`
  }, [redirectUrl])

  const onPress = useCallback(async () => {
    if (!clerk.loaded || busy) return
    setBusy(true)
    setInitError(null)
    let idTokenUsed: string | null = null
    try {
      await ensureSocialLoginInitialized()
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      // Do not pass `scopes` here: the Android plugin rejects custom scopes unless MainActivity
      // implements ModifiedMainActivityForSocialLoginPlugin. Defaults already include email + profile + openid.
      const loginResult = await SocialLogin.login({
        provider: 'google',
        options: {},
      })

      if (loginResult.provider !== 'google') {
        throw new Error('Unexpected login provider')
      }

      const token =
        'idToken' in loginResult.result && loginResult.result.idToken
          ? loginResult.result.idToken
          : null

      if (!token) {
        throw new Error('Google did not return an ID token. Check Android SHA-1 / iOS client ID in Google Cloud.')
      }

      idTokenUsed = token

      const oneTapParams: { token: string; legalAccepted?: boolean } = { token }
      if (process.env.NEXT_PUBLIC_NATIVE_GOOGLE_LEGAL_ACCEPTED === '1') {
        oneTapParams.legalAccepted = true
      }

      const authResult = await clerk.authenticateWithGoogleOneTap(oneTapParams)

      const sessionId = authResult.createdSessionId
      const finished = authResult.status === 'complete'

      if (sessionId && finished) {
        const dest = mode === 'sign-in' ? afterSignInUrl() : afterSignUpUrl()
        await clerk.setActive({ session: sessionId })
        await router.replace(dest)
        return
      }

      await clerk.handleGoogleOneTapCallback(
        authResult,
        {
          signInUrl: '/sign-in',
          signUpUrl: '/sign-up',
          signInForceRedirectUrl: afterSignInUrl(),
          signUpForceRedirectUrl: afterSignUpUrl(),
          verifyPhoneNumberUrl: afterSignUpUrl(),
        },
        async (to: string) => {
          await router.replace(to)
        }
      )
    } catch (e) {
      let message = e instanceof Error ? e.message : 'Google sign-in failed'
      if (/not authorized|authorization_invalid/i.test(message)) {
        const tokenAud = idTokenUsed ? readGoogleIdTokenAud(idTokenUsed) : null
        const expected = webClientId ?? ''
        const audHint =
          tokenAud && expected && tokenAud !== expected
            ? ` Token aud is "${tokenAud}" but NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID is "${expected}" — they must match the Web client ID in Clerk → Google.`
            : tokenAud && expected && tokenAud === expected
              ? ' Token aud matches your Web client ID; if this persists, add the app under Clerk → Native applications (package + SHA-256) and redeploy.'
              : ''
        message = `${message} — Check Clerk → Native applications (Android package + SHA-256), and that the Google Web client in Clerk matches NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID.${audHint} Try NEXT_PUBLIC_NATIVE_GOOGLE_LEGAL_ACCEPTED=1 if your instance requires terms acceptance. See docs/NATIVE_GOOGLE_SETUP.md.`
      }
      if (mounted.current) setInitError(message)
      console.error('[NativeGoogleSignIn]', e)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [afterSignInUrl, afterSignUpUrl, busy, clerk, mode, router, webClientId])

  if (!Capacitor.isNativePlatform()) return null
  if (!webClientId) return null

  const label = mode === 'sign-in' ? 'Continue with Google' : 'Sign up with Google'

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        disabled={!clerk.loaded || busy}
        className="w-full border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white"
        onClick={() => void onPress()}
      >
        {busy ? 'Signing in…' : label}
      </Button>
      {initError ? (
        <p className="mt-2 text-center text-xs text-red-400" role="alert">
          {initError}
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-500">
          Uses your Google account saved on this device.
        </p>
      )}
    </div>
  )
}
