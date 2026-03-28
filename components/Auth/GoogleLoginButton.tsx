'use client'

/**
 * Capacitor Google OAuth via {@link useGoogleOAuthCapacitor} (Clerk v6 has no `useOAuth` export).
 */

import { useCallback, useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Button } from '@/components/ui/button'
import { useGoogleOAuthCapacitor } from '@/hooks/useGoogleOAuthCapacitor'

export type GoogleLoginButtonProps = {
  mode: 'sign-in' | 'sign-up'
  redirectUrl?: string | null
  className?: string
}

export function GoogleLoginButton({ mode, redirectUrl, className }: GoogleLoginButtonProps) {
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

  const label = mode === 'sign-in' ? 'Continue with Google' : 'Sign up with Google'

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        disabled={!isLoaded || busy}
        className="w-full border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white"
        onClick={() => void onPress()}
      >
        {busy ? 'Signing in…' : label}
      </Button>
      {error ? (
        <p className="mt-2 text-center text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-500">
          Secure browser sign-in; returns to the app when finished.
        </p>
      )}
    </div>
  )
}
