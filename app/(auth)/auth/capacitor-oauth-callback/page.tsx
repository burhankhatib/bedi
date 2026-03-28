'use client'

import { useEffect, useRef, useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { InAppBrowser } from '@capacitor/inappbrowser'
import { Loader2 } from 'lucide-react'
import { getAllowedRedirectPath } from '@/lib/auth-utils'
import { consumeOAuthReturnTo } from '@/lib/capacitor-native-oauth'

export default function CapacitorOAuthCallback() {
  const clerk = useClerk()
  const router = useRouter()
  const [status, setStatus] = useState('Completing sign in...')
  const handled = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (handled.current || !clerk.loaded) return
    handled.current = true

    async function finish() {
      if (Capacitor.isNativePlatform()) {
        try {
          await InAppBrowser.close()
        } catch (e) {
          // ignore
        }
      }

      try {
        const url = new URL(window.location.href)
        const returnTo = url.searchParams.get('returnTo') ?? consumeOAuthReturnTo()
        const safeReturn = getAllowedRedirectPath(returnTo, '/')
        
        await clerk.handleRedirectCallback({
          signInUrl: '/sign-in',
          signUpUrl: '/sign-up',
          signInForceRedirectUrl: returnTo ? `/auth/continue?returnTo=${encodeURIComponent(safeReturn)}` : '/',
          signUpForceRedirectUrl: returnTo ? `/verify-phone?returnTo=${encodeURIComponent(safeReturn)}` : '/verify-phone',
        })
        
        // Safety timeout if handleRedirectCallback finishes but router hasn't moved
        setTimeout(() => {
          if (mounted.current) {
            window.location.href = returnTo ? `/auth/continue?returnTo=${encodeURIComponent(safeReturn)}` : '/'
          }
        }, 1500)
      } catch (err) {
        console.error('OAuth callback error:', err)
        setStatus('Sign in failed. Redirecting...')
        setTimeout(() => {
          router.replace('/sign-in')
        }, 2000)
      }
    }
    finish()
  }, [clerk.loaded, clerk, router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <p className="text-slate-600 font-medium">{status}</p>
    </div>
  )
}
