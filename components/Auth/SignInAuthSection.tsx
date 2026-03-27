'use client'

import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { ClerkSignInNativeAware } from '@/components/Auth/ClerkSignInNativeAware'
import { NativeGoogleSignInButton } from '@/components/Auth/NativeGoogleSignInButton'

type Surface = 'pending' | 'web' | 'native'

function AuthCardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4" aria-busy="true" aria-label="Loading sign-in">
      <div className="h-11 animate-pulse rounded-lg bg-slate-800/70 px-1" />
      <div className="h-[min(28rem,70vh)] animate-pulse rounded-xl border border-slate-800 bg-slate-900/80" />
    </div>
  )
}

export type SignInAuthSectionProps = {
  afterSignInUrl: string
  signUpUrl: string
  redirectUrl?: string | null
}

/**
 * Resolves web vs Capacitor once on the client, then shows either Clerk OAuth (web) or
 * native Google + email/password only (app) — never both Google entry points at once.
 */
export function SignInAuthSection({ afterSignInUrl, signUpUrl, redirectUrl }: SignInAuthSectionProps) {
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
        <NativeGoogleSignInButton mode="sign-in" redirectUrl={redirectUrl} className="px-1" />
      ) : null}
      <ClerkSignInNativeAware
        oauthMode={oauthMode}
        appearance={{
          variables: { colorPrimary: '#f59e0b' },
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl border border-slate-800 bg-slate-900',
          },
        }}
        afterSignInUrl={afterSignInUrl}
        signUpUrl={signUpUrl}
      />
    </div>
  )
}
