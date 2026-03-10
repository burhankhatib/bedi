'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrderDetailsModal } from '@/components/Orders/OrderDetailsModal'
import { Loader2 } from 'lucide-react'

export function AdminOrderViewClient({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [data, setData] = useState<{ order: Record<string, unknown>; tenantSlug: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Order not found' : 'Failed to load order')
        return res.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [orderId])

  const handleClose = () => router.push('/admin/reports')

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-slate-400">
        <p>{error}</p>
        <button
          type="button"
          onClick={handleClose}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
        >
          Back to Reports
        </button>
      </div>
    )
  }

  if (!data?.order) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
        Loading order…
      </div>
    )
  }

  return (
    <OrderDetailsModal
      order={data.order as unknown as Parameters<typeof OrderDetailsModal>[0]['order']}
      tenantSlug={data.tenantSlug ?? undefined}
      onClose={handleClose}
      onStatusUpdate={async () => {}}
      onRefresh={() => {}}
    />
  )
}
