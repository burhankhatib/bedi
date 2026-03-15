import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { AreasMap } from './AreasMap'

export default async function AdminAreasPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/areas')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Platform Service Areas</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">
        Platform city boundaries for geofencing. Edit polygons in-dashboard and save to Sanity.
      </p>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white">Platform cities (service areas)</h2>
        <p className="mt-1 text-sm text-slate-400">
          Click a city, use the Edit tool to drag vertices, then Save. Data is stored in Sanity.
        </p>
        <div className="mt-4">
          <AreasMap />
        </div>
      </div>
    </div>
  )
}
