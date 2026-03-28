'use client'

/**
 * Capacitor Google OAuth via {@link useGoogleOAuthCapacitor} (Clerk v6 has no `useOAuth` export).
 * Dark-theme “Sign in with Google” affordance (multicolor G + Google dark fill/border/text on dark auth).
 * Colors align with https://developers.google.com/identity/branding-guidelines (dark UI variant).
 */

import { useCallback, useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { FcGoogle } from 'react-icons/fc'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import { useGoogleOAuthCapacitor } from '@/hooks/useGoogleOAuthCapacitor'

export type GoogleLoginButtonProps = {
  mode: 'sign-in' | 'sign-up'
  redirectUrl?: string | null
  className?: string
}

export function GoogleLoginButton({ mode, redirectUrl, className }: GoogleLoginButtonProps) {
  const { t } = useLanguage()
  const { isLoaded, startOAuth } = useGoogleOAuthCapacitor(mode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])

  const onPress = useCallback(async () => {
    if (!isLoaded || busy) return
    setBusy(true)
    setError(null)
    try {
      await startOAuth({ redirectUrl })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Google sign-in failed'
      if (mounted.current) setError(message)
      console.error('[GoogleLoginButton]', e)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [busy, isLoaded, redirectUrl, startOAuth])

  if (!Capacitor.isNativePlatform()) return null

  const label =
    mode === 'sign-in'
      ? t('Continue with Google', 'المتابعة مع Google')
      : t('Sign up with Google', 'إنشاء حساب عبر Google')
  const busyLabel = t('Signing in…', 'جاري تسجيل الدخول…')
  const helper = t(
    'Opens Google in your browser, then returns to this app.',
    'يفتح Google في المتصفح ثم يعيدك إلى التطبيق.',
  )

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        disabled={!isLoaded || busy}
        className="h-12 w-full gap-3 rounded-xl border border-[#8e918f] bg-[#131314] px-4 text-[15px] font-medium text-[#e3e3e3] shadow-none hover:bg-[#2c2c2c] hover:text-[#e3e3e3] focus-visible:border-[#8e918f] focus-visible:ring-2 focus-visible:ring-[#e3e3e3]/25 disabled:opacity-60 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#2c2c2c] dark:hover:text-[#e3e3e3]"
        onClick={() => void onPress()}
        aria-label={busy ? busyLabel : label}
      >
        <FcGoogle className="size-[22px] shrink-0" aria-hidden />
        <span>{busy ? busyLabel : label}</span>
      </Button>
      {error ? (
        <p className="mt-2 text-center text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-500">{helper}</p>
      )}
    </div>
  )
}
