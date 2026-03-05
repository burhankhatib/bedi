import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { DriverProfileClient } from './DriverProfileClient'

export const dynamic = 'force-dynamic'

export default async function DriverProfilePage() {
  let userId: string | null = null
  try {
    const result = await auth()
    userId = result?.userId ?? null
  } catch {
    redirect('/sign-in?redirect_url=/driver/profile')
  }
  if (!userId) {
    redirect('/sign-in?redirect_url=/driver/profile')
  }
  return (
    <div>
      <h1 className="mb-4 font-bold text-white sm:mb-6">الملف الشخصي</h1>
      <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>}>
        <DriverProfileClient />
      </Suspense>
    </div>
  )
}
