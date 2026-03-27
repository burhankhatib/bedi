'use client'

import { SignIn } from '@clerk/nextjs'
import { Capacitor } from '@capacitor/core'
import { useEffect, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'

/**
 * On Capacitor, Clerk's redirect OAuth (e.g. Google in the card) opens Clerk URLs that fail with
 * `authorization_invalid` in WebView. Hide OAuth UI on native; use NativeGoogleSignInButton instead.
 */
export function ClerkSignInNativeAware(props: ComponentProps<typeof SignIn>) {
  const [isNative, setIsNative] = useState(false)

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())
  }, [])

  const appearance = useMemo(() => {
    const base = props.appearance ?? {}
    const elements = {
      ...(typeof base.elements === 'object' && base.elements ? base.elements : {}),
      ...(isNative
        ? {
            socialButtonsRoot: '!hidden',
            dividerRow: '!hidden',
          }
        : {}),
    }
    return { ...base, elements }
  }, [isNative, props.appearance])

  return <SignIn {...props} appearance={appearance} />
}
