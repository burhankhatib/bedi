import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { PayrollManageClient } from './PayrollManageClient'

export default async function ManagePayrollPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'payroll')) redirect(`/t/${slug}/manage`)

  return <PayrollManageClient slug={slug} />
}

