import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { client } from '@/sanity/lib/client'
import { AreasManageClient } from './AreasManageClient'

export default async function ManageAreasPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'settings_areas')) redirect(`/t/${slug}/manage`)

  const [areas, tenant] = await Promise.all([
    client.fetch<
      Array<{
        _id: string
        name_en: string
        name_ar: string
        deliveryPrice: number
        currency: string
        isActive: boolean
        sortOrder?: number
      }>
    >(
      `*[_type == "area" && site._ref == $siteId] | order(sortOrder asc) { _id, name_en, name_ar, deliveryPrice, currency, isActive, sortOrder }`,
      { siteId: auth.tenantId }
    ),
    client.fetch<{ country?: string; city?: string } | null>(
      `*[_type == "tenant" && _id == $tenantId][0]{ country, city }`,
      { tenantId: auth.tenantId }
    ),
  ])

  return (
    <div>
      <h1 className="text-xl font-bold">Delivery areas</h1>
      <p className="mt-1 text-slate-400">Define areas where you deliver and set the delivery fee for each.</p>
      <AreasManageClient
        slug={slug}
        initialAreas={areas || []}
        initialCountry={tenant?.country ?? ''}
        initialCity={tenant?.city ?? ''}
      />
    </div>
  )
}
