'use client'

import { SignIn } from '@clerk/nextjs'
import { useMemo } from 'react'
import type { ComponentProps } from 'react'

export type ClerkSignInNativeAwareProps = ComponentProps<typeof SignIn> & {
  /**
   * `hide` — no Clerk social/OAuth row (native app uses `GoogleLoginButton` + native Google Sign-In).
   * `show` — normal Clerk UI including Google etc.
   */
  oauthMode?: 'show' | 'hide'
}

export function ClerkSignInNativeAware({
  oauthMode = 'show',
  ...props
}: ClerkSignInNativeAwareProps) {
  const appearance = useMemo(() => {
    const base = props.appearance ?? {}
    const elements = {
      ...(typeof base.elements === 'object' && base.elements ? base.elements : {}),
      ...(oauthMode === 'hide'
        ? {
            socialButtonsRoot: '!hidden',
            socialButtons: '!hidden',
            dividerRow: '!hidden',
          }
        : {}),
    }
    return { ...base, elements }
  }, [oauthMode, props.appearance])

  return <SignIn {...props} appearance={appearance} />
}
