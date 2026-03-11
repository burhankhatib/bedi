import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bedi Business',
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
