import { OrderTrackClient } from './OrderTrackClient'
import { notFound } from 'next/navigation'

export default async function TrackByTokenPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>
}) {
  const { slug, token } = await params

  if (!slug?.trim() || !token?.trim()) notFound()

  return (
    <main className="min-h-screen bg-slate-100">
      <OrderTrackClient slug={slug} token={token} />
    </main>
  )
}
