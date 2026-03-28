'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useRouter } from 'next/navigation'
import { isNativeOAuthCallbackDeepLink, nativeOAuthCallbackSearchParams } from '@/lib/capacitor-native-oauth'

export function CapacitorAppUrlListener() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listener = App.addListener('appUrlOpen', (event) => {
      // Clerk native redirect: com.burhankhatib.bedi(.driver|.tenant)://oauth-callback?...
      if (isNativeOAuthCallbackDeepLink(event.url)) {
        const search = nativeOAuthCallbackSearchParams(event.url)
        router.push(`/auth/capacitor-oauth-callback${search}`)
        return
      }

      const url = new URL(event.url)
      if (url.hostname === 'www.bedi.delivery' || url.hostname === 'bedi.delivery') {
        const pathWithQuery = url.pathname + url.search
        router.push(pathWithQuery)
      }
    })

    return () => {
      listener.then((l) => l.remove()).catch(() => {})
    }
  }, [router])

  return null
}
