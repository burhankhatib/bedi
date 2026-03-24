import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { AdminBroadcastClient } from './AdminBroadcastClient'

export default async function AdminBroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/broadcast')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  const sp = await searchParams
  const initialTab = sp.tab === 'inbox' ? 'inbox' : 'broadcast'

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">WhatsApp Broadcast & Inbox</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">
        Send mass WhatsApp messages (Broadcast) or view and reply to incoming messages (Inbox).
      </p>
      <div className="mt-4 mb-6 rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
        <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
          Meta Webhook Setup (Required for Inbox)
        </h3>
        <ul className="mt-2 text-xs text-blue-200/80 list-disc list-inside pl-2 space-y-1">
          <li>Go to your WhatsApp Cloud API app in the Meta Developer Console.</li>
          <li>Under Webhooks, subscribe to the <strong>messages</strong> field for your WhatsApp Business Account.</li>
          <li>Set the Callback URL to <code className="bg-blue-900/50 px-1 rounded text-blue-200">https://&lt;your-domain&gt;/api/webhooks/whatsapp</code></li>
          <li>Set the Verify Token to match your <code className="bg-blue-900/50 px-1 rounded text-blue-200">WHATSAPP_VERIFY_TOKEN</code> environment variable.</li>
        </ul>
      </div>
      <AdminBroadcastClient initialTab={initialTab} />
    </div>
  )
}
