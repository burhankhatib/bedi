'use client'

import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'

/**
 * Hook for order flow: sign-in + phone verification required to place orders.
 * Drivers and tenants with a phone in the system are treated as verified (no SMS needed).
 * Used by menu/cart to show gate and prefill verified phone.
 */
export function useOrderAuth() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const { user, isLoaded: userLoaded } = useUser()
  const [orderPhone, setOrderPhone] = useState<{ hasVerifiedPhone: boolean; verifiedPhoneValue: string } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isSignedIn || !user) {
        setOrderPhone(null)
        return
      }
      let cancelled = false
      fetch('/api/me/order-phone', { credentials: 'include', cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data && typeof data.hasVerifiedPhone === 'boolean')
            setOrderPhone({ hasVerifiedPhone: data.hasVerifiedPhone, verifiedPhoneValue: data.verifiedPhoneValue ?? '' })
        })
        .catch(() => {
          if (!cancelled) setOrderPhone(null)
        })
      return () => { cancelled = true }
    }, 0)
    return () => clearTimeout(timer)
  }, [isSignedIn, user, user?.id])

  const isLoaded = authLoaded && userLoaded
  const fromClerk = Boolean(
    user?.phoneNumbers?.some((p) => (p as { verification?: { status?: string | null } }).verification?.status === 'verified')
  )
  const clerkPhone =
    (user?.phoneNumbers?.find((p) => (p as { verification?: { status?: string | null } }).verification?.status === 'verified') as { phoneNumber?: string } | undefined)?.phoneNumber ?? ''

  const hasVerifiedPhone = orderPhone?.hasVerifiedPhone ?? fromClerk
  const verifiedPhoneValue = (orderPhone?.verifiedPhoneValue && orderPhone.verifiedPhoneValue !== '') ? orderPhone.verifiedPhoneValue : clerkPhone

  return {
    isLoaded,
    isSignedIn: !!isSignedIn,
    hasVerifiedPhone,
    verifiedPhoneValue,
    needsSignIn: isLoaded && !isSignedIn,
    needsPhoneVerification: isLoaded && !!isSignedIn && !hasVerifiedPhone,
    clerkUser: user,
  }
}
