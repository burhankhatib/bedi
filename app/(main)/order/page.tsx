'use client'

import { Suspense } from 'react'
import OrderContent from './OrderContent'
import { OrderPageSkeleton } from '@/components/loading'

export default function OrderPage() {
  return (
    <Suspense fallback={<OrderPageSkeleton />}>
      <OrderContent />
    </Suspense>
  )
}
