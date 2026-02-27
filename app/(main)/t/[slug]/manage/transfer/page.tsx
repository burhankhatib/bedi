import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { TransferManageClient } from './TransferManageClient'

export default async function ManageTransferPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'transfer')) redirect(`/t/${slug}/manage`)

  return <TransferManageClient slug={slug} />
}
