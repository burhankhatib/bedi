import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { AdminAreasClient } from './AdminAreasClient'

export default async function AdminAreasPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/areas')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Delivery Areas</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">
        Edit area names (EN/AR) to fix typos. Filter by city or business. Duplicate areas for the same business are prevented when tenants add areas.
      </p>
      <AdminAreasClient />
    </div>
  )
}
