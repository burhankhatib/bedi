'use client'

import { SignUp } from '@clerk/nextjs'
import { Capacitor } from '@capacitor/core'
import { useEffect, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'

/** Same as ClerkSignInNativeAware: avoid broken WebView OAuth on native. */
export function ClerkSignUpNativeAware(props: ComponentProps<typeof SignUp>) {
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

  return <SignUp {...props} appearance={appearance} />
}
