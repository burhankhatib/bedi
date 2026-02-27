import { OrderTrackClient } from './OrderTrackClient'
import { notFound } from 'next/navigation'

export default async function OrderTrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderId: string }>
  searchParams: Promise<{ phone?: string }>
}) {
  const { slug, orderId } = await params
  const { phone } = await searchParams

  if (!slug || !orderId) notFound()
  if (!phone?.trim()) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm max-w-md">
          <p className="text-slate-600">
            Missing phone. Open the link from the message you received after placing your order, or use the link from your order confirmation.
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <OrderTrackClient slug={slug} orderId={orderId} phone={phone.trim()} />
    </main>
  )
}
