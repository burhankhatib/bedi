'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/LanguageContext'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Calendar, WifiOff } from 'lucide-react'

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const TRIAL_DAYS = 30
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000

/** Effective expiry: subscriptionExpiresAt, or for trial without it, businessCreatedAt (or createdAt) + 30 days */
function effectiveExpiry(expiresAt: string | null, createdAt: string | null, businessCreatedAt: string | null, status: string): Date | null {
  if (expiresAt) return new Date(expiresAt)
  if (status === 'trial') {
    const createdDate = businessCreatedAt || createdAt
    if (createdDate) {
      const created = new Date(createdDate).getTime()
      return new Date(created + TRIAL_MS)
    }
  }
  return null
}

const OFFLINE_MESSAGE_EN =
  'Business is now Offline and not visible to customers. Subscribe or choose a package and pay in order to get your business up and running again.'
const OFFLINE_MESSAGE_AR =
  'المتجر غير متصل الآن وغير ظاهر للعملاء. اشترك أو اختر باقة وادفع لإعادة تشغيل متجرك من جديد.'

type InitialData = {
  subscriptionExpiresAt: string | null
  createdAt: string | null
  businessCreatedAt?: string | null
  subscriptionStatus: string
} | null

export function SubscriptionBanner({ slug, initialData = null }: { slug: string; initialData?: InitialData }) {
  const { t } = useLanguage()
  const [expiresAt, setExpiresAt] = useState<string | null>(initialData?.subscriptionExpiresAt ?? null)
  const [createdAt, setCreatedAt] = useState<string | null>(initialData?.createdAt ?? null)
  const [businessCreatedAt, setBusinessCreatedAt] = useState<string | null>(initialData?.businessCreatedAt ?? null)
  const [status, setStatus] = useState<string>(initialData?.subscriptionStatus ?? 'trial')
  const [loaded, setLoaded] = useState(!!initialData)

  useEffect(() => {
    fetch(`/api/tenants/${slug}/subscription`)
      .then((r) => r.json())
      .then((data) => {
        setExpiresAt(data?.subscriptionExpiresAt ?? null)
        setCreatedAt(data?.createdAt ?? null)
        setBusinessCreatedAt(data?.businessCreatedAt ?? null)
        setStatus(data?.subscriptionStatus ?? 'trial')
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [slug])

  const expiry = effectiveExpiry(expiresAt, createdAt, businessCreatedAt, status)
  const now = Date.now()
  const isExpired = expiry ? expiry.getTime() <= now : !expiresAt && !(businessCreatedAt || createdAt)
  const daysLeft = expiry && !isExpired
    ? Math.max(0, Math.ceil((expiry.getTime() - now) / (24 * 60 * 60 * 1000)))
    : 0
  const withinOneWeek = expiry && expiry.getTime() - now <= ONE_WEEK_MS && !isExpired
  const hasActivePlan = expiry && !isExpired
  const isSubscribed = status === 'active' || (hasActivePlan && status !== 'trial')
  const isTrialNoExpiry = !expiresAt && status === 'trial' && (businessCreatedAt || createdAt)
  const isTrialNoExpiryData = !expiresAt && status === 'trial'

  const billingHref = `/t/${slug}/manage/billing`

  const OfflineBox = () => (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-rose-500/70 bg-rose-500/20 px-4 py-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/30">
          <WifiOff className="size-5 text-rose-300" aria-hidden />
        </div>
        <div>
          <p className="font-semibold text-rose-100">
            {t('Business is now Offline', 'المتجر غير متصل الآن')}
          </p>
          <p className="mt-1 text-sm text-rose-200/95">
            {t(OFFLINE_MESSAGE_EN, OFFLINE_MESSAGE_AR)}
          </p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400">
        <Link href={billingHref}>{t('Subscribe or pay', 'اشترك أو ادفع')}</Link>
      </Button>
    </div>
  )

  if (status === 'past_due') {
    return <OfflineBox />
  }

  if (isTrialNoExpiry && isExpired) {
    return <OfflineBox />
  }

  if (isTrialNoExpiry && withinOneWeek) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/60 bg-amber-500/15 px-4 py-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium text-amber-200">
              {t('Your 30-day trial ends in less than a week.', 'تجربتك المجانية لـ 30 يوماً تنتهي خلال أقل من أسبوع.')}
            </p>
            <p className="mt-0.5 text-sm text-amber-200/90">
              <strong>{daysLeft}</strong> {t('days left', 'أيام متبقية')} — {t('Choose a subscription so your site stays visible.', 'اختر اشتراكاً ليبقى موقعك ظاهراً.')}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400">
          <Link href={billingHref}>{t('Choose subscription', 'اختر اشتراكاً')}</Link>
        </Button>
      </div>
    )
  }

  if (isTrialNoExpiry) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <Calendar className="size-5 shrink-0 text-emerald-400" />
          <div>
            <p className="font-medium text-white">
              {t('Trial', 'تجربة')}: <strong className="text-emerald-300">{daysLeft}</strong> {t('days left', 'أيام متبقية')} — {t('30-day trial from creation.', 'تجربة 30 يوماً من الإنشاء.')}
            </p>
            <p className="mt-0.5 text-sm text-slate-400">
              {t('Choose a subscription so your site remains visible to customers.', 'اختر اشتراكاً ليبقى موقعك ظاهراً للعملاء.')}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400">
          <Link href={billingHref}>{t('Choose subscription', 'اختر اشتراكاً')}</Link>
        </Button>
      </div>
    )
  }

  if (!expiresAt) {
    if (isTrialNoExpiryData && loaded) {
      return <OfflineBox />
    }
    return null
  }

  if (isExpired) {
    return <OfflineBox />
  }

  if (withinOneWeek) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/60 bg-amber-500/15 px-4 py-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium text-amber-200">
              {t('Your subscription expires in less than a week.', 'اشتراكك ينتهي خلال أقل من أسبوع.')}
            </p>
            <p className="mt-0.5 text-sm text-amber-200/90">
              <strong>{daysLeft}</strong> {t('days left', 'أيام متبقية')} — {t('Pay now to keep your business visible.', 'ادفع الآن لإبقاء متجرك ظاهراً.')}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400">
          <Link href={billingHref}>{t('Subscribe / Pay', 'اشترك / ادفع')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <Calendar className="size-5 shrink-0 text-emerald-400" />
        <div>
          <p className="font-medium text-white">
            {t('Plan active', 'الخطة نشطة')}: <strong className="text-emerald-300">{daysLeft}</strong> {t('days left', 'أيام متبقية')}
          </p>
          <p className="mt-0.5 text-sm text-slate-400">
            {t('Your business is visible until the end of your billing period.', 'متجرك ظاهر حتى نهاية فترة الفوترة.')}
          </p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0 border border-slate-600 bg-slate-700 font-medium text-white hover:bg-slate-600 hover:text-white">
        <Link href={billingHref}>
          {isSubscribed ? t('View Subscription', 'عرض الاشتراك') : t('Subscribe', 'اشترك')}
        </Link>
      </Button>
    </div>
  )
}
