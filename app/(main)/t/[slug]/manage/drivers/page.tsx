import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'

// Drivers section hidden: drivers managed centrally. Redirect to manage.
export default async function ManageDriversPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  redirect(`/t/${slug}/manage`)
}
