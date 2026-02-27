import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DriverJoinPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/driver/profile')
  }
  redirect('/driver/profile')
}
