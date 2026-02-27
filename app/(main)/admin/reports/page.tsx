import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { AdminReportsClient } from './AdminReportsClient'

export default async function AdminReportsPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/reports')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Reports</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">All reports from businesses, drivers, and customers.</p>
      <AdminReportsClient />
    </div>
  )
}
