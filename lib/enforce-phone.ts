import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'

/**
 * Ensures the user has a verified phone number in Clerk.
 * If not, redirects them to /verify-phone with the provided returnTo path.
 */
export async function enforcePhoneVerification(returnTo: string) {
  const user = await currentUser()
  if (!user) return

  const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
  if (email && isSuperAdminEmail(email)) {
    return // Super admins are exempt
  }

  const hasVerifiedPhone = user.phoneNumbers?.some(
    (pn) => pn.verification?.status === 'verified'
  )

  if (!hasVerifiedPhone) {
    redirect(`/verify-phone?returnTo=${encodeURIComponent(returnTo)}`)
  }
}
