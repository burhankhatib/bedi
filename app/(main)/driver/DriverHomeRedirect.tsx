'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/LanguageContext'

/**
 * Used on /driver: redirect to profile if not yet complete, otherwise to orders.
 * Ensures new drivers land on profile first without briefly showing the Orders page.
 */
export function DriverHomeRedirect() {
  const router = useRouter()
  const { t } = useLanguage()
  useEffect(() => {
    fetch('/api/driver/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data?._id) {
          router.replace('/driver/orders')
        } else {
          router.replace('/driver/profile')
        }
      })
      .catch(() => router.replace('/driver/profile'))
  }, [router])
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
      <p>{t('Redirecting…', 'جاري التوجيه...')}</p>
    </div>
  )
}
