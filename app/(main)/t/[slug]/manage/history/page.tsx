import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { HistoryOrdersClient } from './HistoryOrdersClient'

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'history')) redirect(`/t/${slug}/manage`)
  return <HistoryOrdersClient slug={slug} />
}
