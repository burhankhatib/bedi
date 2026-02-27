'use client'

import { Suspense } from 'react'
import OrderContent from './OrderContent'

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-black rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading order...</p>
        </div>
      </div>
    }>
      <OrderContent />
    </Suspense>
  )
}
