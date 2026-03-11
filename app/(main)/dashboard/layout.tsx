import type { Metadata } from 'next'
import { MANIFEST_VERSION } from '@/lib/pwa/constants'

export const metadata: Metadata = {
  title: 'Bedi Business',
  manifest: `/dashboard/manifest.webmanifest?v=${MANIFEST_VERSION}`,
  icons: {
    icon: '/adminslogo.webp',
    apple: '/adminslogo.webp',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bedi Business',
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
