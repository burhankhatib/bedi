'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'

export function StudioAuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.replace('/sign-in?redirect_url=' + encodeURIComponent('/studio'))
      return
    }
    const email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      ''
    if (!email || email !== SUPER_ADMIN_EMAIL) {
      router.replace('/dashboard')
    }
  }, [isLoaded, isSignedIn, user, router])

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="text-slate-500">Loading…</span>
      </div>
    )
  }

  if (!isSignedIn) {
    return null
  }

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
  ''
  if (!email || email !== SUPER_ADMIN_EMAIL) {
    return null
  }

  return <>{children}</>
}
