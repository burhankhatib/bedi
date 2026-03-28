'use client'

import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { ClerkSignUpNativeAware } from '@/components/Auth/ClerkSignUpNativeAware'
import { GoogleLoginButton } from '@/components/Auth/GoogleLoginButton'

type Surface = 'pending' | 'web' | 'native'

function AuthCardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4" aria-busy="true" aria-label="Loading sign-up">
      <div className="h-11 animate-pulse rounded-lg bg-slate-800/70 px-1" />
      <div className="h-[min(32rem,75vh)] animate-pulse rounded-xl border border-slate-800 bg-slate-900/80" />
    </div>
  )
}

export type SignUpAuthSectionProps = {
  afterSignUpUrl: string
  signInUrl: string
  redirectUrl?: string | null
}

export function SignUpAuthSection({ afterSignUpUrl, signInUrl, redirectUrl }: SignUpAuthSectionProps) {
  const [surface, setSurface] = useState<Surface>('pending')

  useEffect(() => {
    setSurface(Capacitor.isNativePlatform() ? 'native' : 'web')
  }, [])

  if (surface === 'pending') {
    return <AuthCardSkeleton />
  }

  const oauthMode = surface === 'native' ? 'hide' : 'show'

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {surface === 'native' ? (
        <GoogleLoginButton mode="sign-up" redirectUrl={redirectUrl} className="px-1" />
      ) : null}
      <ClerkSignUpNativeAware
        oauthMode={oauthMode}
        appearance={{
          variables: { colorPrimary: '#f59e0b' },
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl border border-slate-800 bg-slate-900',
          },
        }}
        afterSignUpUrl={afterSignUpUrl}
        signInUrl={signInUrl}
      />
    </div>
  )
}
