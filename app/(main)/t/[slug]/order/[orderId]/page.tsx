import { OrderTrackClient } from './OrderTrackClient'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export default async function OrderTrackPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>
}) {
  const { slug, orderId } = await params
  
  if (!slug || !orderId) notFound()

  const { userId } = await auth()
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/t/${slug}/order/${orderId}`)}`)
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <OrderTrackClient slug={slug} orderId={orderId} />
    </main>
  )
}
