import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getAllTenants } from '@/lib/tenant'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { ImportMenuClient } from './ImportMenuClient'

export default async function AdminImportMenuPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/import-menu')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  const tenants = await getAllTenants()
  return <ImportMenuClient tenants={tenants} />
}
