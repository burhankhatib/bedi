import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { PATH_PERMISSION } from '@/lib/staff-permissions'

const SECTION_ORDER: { path: string; permission: keyof typeof PATH_PERMISSION }[] = [
  { path: '/business', permission: 'business' },
  { path: '/menu', permission: 'menu' },
  { path: '/tables', permission: 'tables' },
  // { path: '/areas', permission: 'areas' },   // Hidden: auto distance-based delivery pricing
  // { path: '/drivers', permission: 'drivers' }, // Hidden: drivers managed centrally
  { path: '/staff', permission: 'staff' },
  { path: '/analytics', permission: 'analytics' },
  { path: '/history', permission: 'history' },
  { path: '/billing', permission: 'billing' },
  { path: '/transfer', permission: 'transfer' },
]

export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  const perm = auth.permissions ?? []
  for (const { path, permission } of SECTION_ORDER) {
    const p = PATH_PERMISSION[permission]
    if (p && perm.includes(p)) {
      redirect(`/t/${slug}/manage${path}`)
    }
  }
  redirect(`/t/${slug}/orders`)
}
