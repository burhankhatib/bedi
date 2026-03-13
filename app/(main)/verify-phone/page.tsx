import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import VerifyPhoneClient from './VerifyPhoneClient'
import { FormSkeleton } from '@/components/loading'

export default async function VerifyPhonePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=' + encodeURIComponent('/verify-phone'))
  }
  return (
    <Suspense fallback={<FormSkeleton />}>
      <VerifyPhoneClient />
    </Suspense>
  )
}
