/**
 * Post-sign-in redirect: checks if user has verified phone.
 * When SignIn (e.g. OAuth/Google) completes, Clerk redirects here.
 * - No auth → sign-in with redirect_url back to continue
 * - Auth but no verified phone → verify-phone?returnTo=X
 * - Auth + verified phone → returnTo or /
 *
 * This ensures OAuth sign-ins (e.g. "Sign in with Google") route new customers
 * to phone verification before they can place orders.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getVerifiedPhoneNumbers } from '@/lib/order-auth'
import { getAllowedRedirectPath } from '@/lib/auth-utils'

export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  const destination = getAllowedRedirectPath(returnTo, '/')

  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=' + encodeURIComponent('/auth/continue?returnTo=' + encodeURIComponent(destination)))
  }

  const verified = await getVerifiedPhoneNumbers(userId)
  if (verified.length > 0) {
    redirect(destination)
  }

  redirect('/verify-phone?returnTo=' + encodeURIComponent(destination))
}
