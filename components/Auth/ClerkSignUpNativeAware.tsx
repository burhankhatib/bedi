'use client'

import { SignUp } from '@clerk/nextjs'
import { useMemo } from 'react'
import type { ComponentProps } from 'react'

export type ClerkSignUpNativeAwareProps = ComponentProps<typeof SignUp> & {
  oauthMode?: 'show' | 'hide'
}

export function ClerkSignUpNativeAware({
  oauthMode = 'show',
  ...props
}: ClerkSignUpNativeAwareProps) {
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

  return <SignUp {...props} appearance={appearance} />
}
