import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { client } from '@/sanity/lib/client'
import { DriversManageClient } from './DriversManageClient'

export default async function ManageDriversPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'settings_drivers')) redirect(`/t/${slug}/manage`)

  const tenant = await client.fetch<{ country?: string; city?: string } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ country, city }`,
    { tenantId: auth.tenantId }
  )
  return (
    <DriversManageClient
      slug={slug}
      initialCountry={tenant?.country ?? ''}
      initialCity={tenant?.city ?? ''}
    />
  )
}
