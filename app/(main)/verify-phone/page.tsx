import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import VerifyPhoneClient from './VerifyPhoneClient'

export default async function VerifyPhonePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=' + encodeURIComponent('/verify-phone'))
  }
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><p className="text-slate-600">Loading...</p></div>}>
      <VerifyPhoneClient />
    </Suspense>
  )
}
