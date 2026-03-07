import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { AdminBroadcastClient } from './AdminBroadcastClient'

export default async function AdminBroadcastPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/broadcast')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">WhatsApp Broadcast</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">
        Send mass WhatsApp messages to your users using the "broadcast_message" Meta template.
      </p>
      <AdminBroadcastClient />
    </div>
  )
}
