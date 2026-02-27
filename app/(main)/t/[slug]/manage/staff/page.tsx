import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { client } from '@/sanity/lib/client'
import { StaffManageClient } from './StaffManageClient'

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
