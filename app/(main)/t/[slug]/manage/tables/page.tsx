import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { getTenantBySlug } from '@/lib/tenant'
import { getEffectivePlanTier, hasTablesAndStaff } from '@/lib/subscription'
import { clientNoCdn } from '@/sanity/lib/client'
import { TablesManageClient } from './TablesManageClient'
import { Button } from '@/components/ui/button'

export default async function ManageTablesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'settings_tables')) redirect(`/t/${slug}/manage`)

  const tenant = await getTenantBySlug(slug, { useCdn: false })
  const tier = tenant ? getEffectivePlanTier(tenant) : 'basic'
  if (!hasTablesAndStaff(tier)) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-8 text-center">
        <h1 className="text-xl font-bold text-white">Tables</h1>
        <p className="mt-3 text-slate-300">
          Tables are available in Pro and Ultra plans. Upgrade your subscription to manage tables.
        </p>
        <Button asChild className="mt-6 bg-amber-500 text-slate-950 hover:bg-amber-400">
          <Link href={`/t/${slug}/manage/billing`}>Upgrade in Billing</Link>
        </Button>
      </div>
    )
  }

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
