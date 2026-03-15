import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { AppNav } from '@/components/saas/AppNav'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { MANIFEST_VERSION } from '@/lib/pwa/constants'

export const metadata: Metadata = {
  manifest: `/admin/manifest.webmanifest?v=${MANIFEST_VERSION}`,
  icons: {
    icon: '/adminslogo.webp',
    apple: '/adminslogo.webp',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bedi Admin',
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin')

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    redirect('/dashboard?error=admin_only')
  }

  return (
    <div className="dark min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <AppNav variant="dashboard" showAdmin />

      <div className="mx-auto flex max-w-[100vw] flex-col sm:container md:flex-row">
        <AdminSidebar />

        <main className="min-w-0 flex-1 px-4 py-4 sm:py-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
