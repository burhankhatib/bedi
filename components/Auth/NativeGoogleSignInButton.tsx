'use client'

import { useClerk } from '@clerk/nextjs'
import { Capacitor } from '@capacitor/core'
import { getAllowedRedirectPath } from '@/lib/auth-utils'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

let socialLoginInitPromise: Promise<void> | null = null

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
    try {
      await ensureSocialLoginInitialized()
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      const loginResult = await SocialLogin.login({
        provider: 'google',
        options: { scopes: ['email', 'profile'] },
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

      const authResult = await clerk.authenticateWithGoogleOneTap({ token })

      await clerk.handleGoogleOneTapCallback(
        authResult,
        {
          signInUrl: '/sign-in',
          signUpUrl: '/sign-up',
          signInForceRedirectUrl: afterSignInUrl(),
          signUpForceRedirectUrl: afterSignUpUrl(),
        },
        async (to: string) => {
          await router.replace(to)
        }
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Google sign-in failed'
      if (mounted.current) setInitError(message)
      console.error('[NativeGoogleSignIn]', e)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [afterSignInUrl, afterSignUpUrl, busy, clerk, router])

  if (!Capacitor.isNativePlatform()) return null
  if (!webClientId) return null

  const label =
    mode === 'sign-in' ? 'Continue with Google (native)' : 'Sign up with Google (native)'

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
          Uses your device Google account. Required on Android/iOS WebView.
        </p>
      )}
    </div>
  )
}
