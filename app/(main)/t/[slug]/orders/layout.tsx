import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return {
    manifest: `/t/${slug}/orders/manifest.webmanifest`,
    icons: {
      icon: `/t/${slug}/icon/192`,
      apple: `/t/${slug}/icon/192`,
    },
  }
}

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
