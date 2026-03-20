import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { AttendanceManageClient } from './AttendanceManageClient'

export default async function ManageAttendancePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'orders')) redirect(`/t/${slug}/manage`)

  return (
    <AttendanceManageClient
      slug={slug}
      canManageStaff={requirePermission(auth, 'staff_manage')}
    />
  )
}

