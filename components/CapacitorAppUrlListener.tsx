'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useRouter } from 'next/navigation'

export function CapacitorAppUrlListener() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listener = App.addListener('appUrlOpen', (event) => {
      // The URL will be something like https://www.bedi.delivery/auth/capacitor-oauth-callback...
      const url = new URL(event.url)
      // Only route if it belongs to our domain
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
