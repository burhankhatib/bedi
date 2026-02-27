import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getAllTenants } from '@/lib/tenant'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { AdminBusinessesTable } from './AdminBusinessesTable'

export default async function AdminBusinessesPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/businesses')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  const tenants = await getAllTenants()

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Businesses</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">All tenants registered on the system. Block access or open their control panel.</p>
      <AdminBusinessesTable tenants={tenants} />
    </div>
  )
}
