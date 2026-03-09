import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'

// Delivery Areas section hidden: auto distance-based pricing in use. Redirect to manage.
export default async function ManageAreasPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  redirect(`/t/${slug}/manage`)
}
