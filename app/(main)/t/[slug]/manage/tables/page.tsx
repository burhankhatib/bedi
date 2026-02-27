import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { clientNoCdn } from '@/sanity/lib/client'
import { TablesManageClient } from './TablesManageClient'

export default async function ManageTablesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'settings_tables')) redirect(`/t/${slug}/manage`)

  const tables = await clientNoCdn.fetch<
    Array<{ _id: string; tableNumber: string; sortOrder?: number }>
  >(
    `*[_type == "tenantTable" && site._ref == $siteId] | order(sortOrder asc, tableNumber asc) { _id, tableNumber, sortOrder }`,
    { siteId: auth.tenantId }
  )

  return (
    <div>
      <h1 className="text-xl font-bold md:text-2xl">Tables</h1>
      <p className="mt-1 text-slate-400 text-sm md:text-base">
        Add tables and generate QR codes. Customers who scan a table QR will have Dine-in and table number pre-filled at checkout.
      </p>
      <TablesManageClient slug={slug} initialTables={tables ?? []} />
    </div>
  )
}
