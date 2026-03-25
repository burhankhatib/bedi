import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { WhatsAppPipelineDebugClient } from '@/components/admin/WhatsAppPipelineDebugClient'

export default async function AdminWhatsAppPipelinePage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/whatsapp-pipeline')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) redirect('/dashboard?error=admin_only')

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">WhatsApp pipeline debug</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">
        Inspect Firestore collections populated by <code className="text-slate-300">/api/webhooks/whatsapp</code> —
        delivery failures and per-message status (sent / delivered / failed).
      </p>
      <WhatsAppPipelineDebugClient />
    </div>
  )
}
