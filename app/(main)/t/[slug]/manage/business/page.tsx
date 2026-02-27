import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { BusinessManageClient } from './BusinessManageClient'

export default async function ManageBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'settings_business')) redirect(`/t/${slug}/manage`)

  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const menuUrl = `${protocol}://${host}/t/${slug}`

  return <BusinessManageClient slug={slug} menuUrl={menuUrl} />
}
