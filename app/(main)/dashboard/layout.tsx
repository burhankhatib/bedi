import type { Metadata } from 'next'

export const metadata: Metadata = {
  manifest: '/dashboard/manifest.webmanifest',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
