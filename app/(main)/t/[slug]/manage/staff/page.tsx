import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { getTenantBySlug } from '@/lib/tenant'
import { getEffectivePlanTier, hasTablesAndStaff } from '@/lib/subscription'
import { client } from '@/sanity/lib/client'
import { StaffManageClient } from './StaffManageClient'
import { Button } from '@/components/ui/button'

const noCacheClient = client.withConfig({ useCdn: false })

export default async function ManageStaffPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'staff_manage')) redirect(`/t/${slug}/manage`)

  const tenantForPlan = await getTenantBySlug(slug, { useCdn: false })
  const tier = tenantForPlan ? getEffectivePlanTier(tenantForPlan) : 'basic'
  if (!hasTablesAndStaff(tier)) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-8 text-center">
        <h1 className="text-xl font-bold text-white">Staff</h1>
        <p className="mt-3 text-slate-300">
          Staff management is available in Pro and Ultra plans. Upgrade your subscription to add staff.
        </p>
        <Button asChild className="mt-6 bg-amber-500 text-slate-950 hover:bg-amber-400">
          <Link href={`/t/${slug}/manage/billing`}>Upgrade in Billing</Link>
        </Button>
      </div>
    )
  }

  const tenant = await noCacheClient.fetch<{ clerkUserEmail?: string | null; name?: string } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ clerkUserEmail, name }`,
    { tenantId: auth.tenantId }
  )
  const ownerEmail = (tenant?.clerkUserEmail as string)?.trim() ?? ''
  const businessName = (tenant?.name && String(tenant.name).trim()) || slug

  return (
    <StaffManageClient
      slug={slug}
      ownerEmail={ownerEmail}
      businessName={businessName}
    />
  )
}
