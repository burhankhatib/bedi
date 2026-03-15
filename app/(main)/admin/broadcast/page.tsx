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
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">WhatsApp Broadcast & Inbox</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">
        Send mass WhatsApp messages (Broadcast) or view and reply to incoming messages (Inbox). Configure the webhook at{' '}
        <code className="rounded bg-slate-800 px-1 py-0.5 text-amber-400/90">/api/webhooks/whatsapp</code> in Meta Developer Console.
      </p>
      <AdminBroadcastClient />
    </div>
  )
}
