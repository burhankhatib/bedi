'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getCategories } from '@/lib/report-categories'
import { useLanguage } from '@/components/LanguageContext'

type ReporterType = 'business' | 'driver' | 'customer'
type ReportedType = 'business' | 'driver' | 'customer'

type ReportFormModalProps = {
  open: boolean
  onClose: () => void
  reporterType: ReporterType
  reportedType: ReportedType
  orderId: string
  slug?: string
  trackingToken?: string
  reportedLabel?: string
  onSuccess?: () => void
  overlayClassName?: string
  contentClassName?: string
}

export function ReportFormModal({
  open,
  onClose,
  reporterType,
  reportedType,
  orderId,
  slug,
  trackingToken,
  reportedLabel,
  onSuccess,
  overlayClassName,
  contentClassName,
}: ReportFormModalProps) {
  const { t, lang } = useLanguage()
  const categories = getCategories(reporterType, reportedType)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterType,
          reportedType,
          orderId,
          category,
          description: description.trim() || undefined,
          ...(slug && { slug }),
          ...(trackingToken && { trackingToken }),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data.error as string) || t('Failed to submit report.', 'فشل في إرسال التقرير.'))
        return
      }
      setCategory('')
      setDescription('')
      onSuccess?.()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const reportedName = reportedLabel || (reportedType === 'driver' ? t('Driver', 'السائق') : reportedType === 'business' ? t('Restaurant', 'المطعم') : t('Customer', 'العميل'))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`sm:max-w-md ${contentClassName || 'z-[350]'}`}
        overlayClassName={overlayClassName || 'z-[350]'}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {t('Report', 'تقرير')} {reportedName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t('Reason', 'السبب')} *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              required
            >
              <option value="">{t('Select…', 'اختر…')}</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {lang === 'ar' ? c.labelAr : c.labelEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t('Details (optional)', 'التفاصيل (اختياري)')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder={t('Add any additional details…', 'أضف أي تفاصيل إضافية…')}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button type="submit" disabled={submitting || !category}>
              {submitting ? t('Sending…', 'جاري الإرسال…') : t('Submit report', 'إرسال التقرير')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
