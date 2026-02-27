'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/components/LanguageContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRightLeft, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

export function TransferManageClient({ slug }: { slug: string }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    fetch(`/api/tenants/${slug}/transfer-request`)
      .then((r) => r.json())
      .then((data: { pending?: boolean }) => {
        setPending(data?.pending === true)
      })
      .catch(() => {})
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError(t('Please enter the new owner\'s email address.', 'يرجى إدخال بريد المالك الجديد.'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/tenants/${slug}/transfer-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerEmail: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || t('Request failed.', 'فشل الطلب.'))
        if (res.status === 409) setPending(true)
        return
      }
      setSuccess(t('Transfer request submitted. Super Admin will review and approve it. You will lose access once approved.', 'تم إرسال طلب النقل. سيراجعه المدير الأعلى ويوافق عليه. ستفقد الوصول بعد الموافقة.'))
      setEmail('')
      setPending(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold sm:text-2xl">
        {t('Transfer ownership', 'نقل الملكية')}
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        {t('Transfer this business to another registered user. The new owner must already have an account on the website. After Super Admin approves, you will lose all access to this business.', 'انقل هذا العمل إلى مستخدم مسجّل آخر. يجب أن يكون للمالك الجديد حساب على الموقع. بعد موافقة المدير الأعلى، ستفقد جميع صلاحيات الوصول لهذا العمل.')}
      </p>

      <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex gap-3">
          <AlertCircle className="size-5 shrink-0 text-amber-400" />
          <div className="text-sm text-amber-200/90">
            <p className="font-semibold">{t('Important', 'مهم')}</p>
            <p className="mt-1">
              {t('Only Super Admin can approve the transfer. After approval, the new owner will have full control and you will no longer be able to access this business.', 'فقط المدير الأعلى يمكنه الموافقة على النقل. بعد الموافقة، سيكون للمالك الجديد التحكم الكامل ولن تتمكن من الوصول لهذا العمل.')}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="newOwnerEmail" className="mb-1.5 block text-sm font-medium text-slate-300">
            {t('New owner email', 'بريد المالك الجديد')}
          </label>
          <Input
            id="newOwnerEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="newowner@example.com"
            className="max-w-md border-slate-600 bg-slate-800/60 text-white placeholder:text-slate-500"
            disabled={loading || pending}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            {t('The person must already be registered on the website.', 'يجب أن يكون الشخص مسجلاً مسبقاً على الموقع.')}
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle className="size-4 shrink-0" />
            {success}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || pending}
          className="gap-2 bg-amber-500 text-slate-950 hover:bg-amber-400"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRightLeft className="size-4" />
          )}
          {pending
            ? t('Request pending', 'الطلب قيد المراجعة')
            : t('Submit transfer request', 'إرسال طلب النقل')}
        </Button>
      </form>
    </div>
  )
}
