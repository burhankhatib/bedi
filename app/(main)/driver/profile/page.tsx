import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { DriverProfileClient } from './DriverProfileClient'
import { FormSkeleton } from '@/components/loading'

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
      <Suspense fallback={<FormSkeleton />}>
        <DriverProfileClient />
      </Suspense>
    </div>
  )
}
