import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getAllTenants } from '@/lib/tenant'
import { AdminTransfersClient } from './AdminTransfersClient'

export default async function AdminTransfersPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/transfers')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  const tenants = await getAllTenants()

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Ownership transfers</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">
        Assign any business to a tenant owner or registered email, or review tenant transfer requests and approve, reject, or assign to someone else.
      </p>
      <AdminTransfersClient tenants={tenants} />
    </div>
  )
}
