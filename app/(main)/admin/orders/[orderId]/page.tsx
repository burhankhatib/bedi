import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { AdminOrderViewClient } from './AdminOrderViewClient'

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/reports')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  const { orderId } = await params
  if (!orderId?.trim()) redirect('/admin/reports')

  return (
    <div>
      <AdminOrderViewClient orderId={orderId} />
    </div>
  )
}
