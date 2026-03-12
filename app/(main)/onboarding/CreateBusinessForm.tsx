'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppNav } from '@/components/saas/AppNav'
import { useLanguage } from '@/components/LanguageContext'
import { BUSINESS_TYPES } from '@/lib/constants'
import { slugify } from '@/lib/slugify'
import { Loader2, Store, ArrowRight, Sparkles } from 'lucide-react'

type Subcategory = { _id: string; slug: string; title_en: string; title_ar: string; businessType: string }

export function CreateBusinessForm() {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [businessSubcategoryIds, setBusinessSubcategoryIds] = useState<string[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!businessType) {
        setSubcategories([])
        setBusinessSubcategoryIds([])
        return
      }
      setSubcategoriesLoading(true)
      setBusinessSubcategoryIds([])
      fetch(`/api/business-subcategories?businessType=${encodeURIComponent(businessType)}`)
        .then((r) => r.json())
        .then((data) => setSubcategories(Array.isArray(data) ? data : []))
        .catch(() => setSubcategories([]))
        .finally(() => setSubcategoriesLoading(false))
    }, 0)
    return () => clearTimeout(timer)
  }, [businessType])

  const handleNameChange = (value: string) => {
    setName(value)
    const suggested = slugify(value)
    if (!slug || slug === slugify(name)) {
      setSlug(suggested)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !businessType) {
      setError(t('Please enter your business name and select a type.', 'يرجى إدخال اسم العمل واختيار النوع.'))
      return
    }
    const phoneTrimmed = ownerPhone.trim()
    // Phone is optional – API uses Clerk-verified number when empty (verified tenants adding another business)
    if (!rulesAcknowledged) {
      setError(t('You must accept the rules and privacy policy to create your business.', 'يجب الموافقة على القواعد وسياسة الخصوصية لإنشاء عملك.'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slugify(slug.trim() || name).slice(0, 96) || undefined,
          businessType,
          ownerPhone: phoneTrimmed || undefined,
          ...(businessSubcategoryIds.length ? { businessSubcategoryIds } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t('Something went wrong', 'حدث خطأ ما'))
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError(t('Network error. Please try again.', 'خطأ في الشبكة. يرجى المحاولة مرة أخرى.'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <AppNav variant="dashboard" />

      <main className="mx-auto max-w-[100vw] px-4 py-6 sm:container sm:py-10 md:py-16">
        <div className="mx-auto max-w-lg">
          <div className="mb-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
              <Store className="size-7" />
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-400">
              <Sparkles className="size-4" />
              {t('Create your first site', 'إنشاء موقعك الأول')}
            </p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">{t('Set up your business', 'إعداد عملك')}</h1>
            <p className="mt-2 text-slate-400 text-sm md:text-base">
              {t('Choose your business type and name. You can change details later in your control panel.', 'اختر نوع العمل والاسم. يمكنك تغيير التفاصيل لاحقاً من لوحة التحكم.')}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {t('Business type', 'نوع العمل')}
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="dashboard-select w-full border border-slate-600 bg-slate-800/50 text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  required
                >
                  <option value="">{t('Select type', 'اختر النوع')}</option>
                  {BUSINESS_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.label, opt.labelAr)}
                    </option>
                  ))}
                </select>
              </div>

              {businessType && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    {t('Specialties / Sub-categories', 'التخصصات / التصنيفات الفرعية')} <span className="text-slate-500">({t('Optional', 'اختياري')})</span>
                  </label>
                  <p className="mb-2 text-xs text-slate-500">{t('Select all that apply. e.g. Burgers, Sandwiches, Pizza.', 'اختر كل ما ينطبق. مثال: برجر، شطائر، بيتزا.')}</p>
                  {subcategoriesLoading ? (
                    <p className="text-xs text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {subcategories.map((sub) => {
                        const checked = businessSubcategoryIds.includes(sub._id)
                        return (
                          <label
                            key={sub._id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              checked ? 'border-amber-500/60 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setBusinessSubcategoryIds((prev) =>
                                  prev.includes(sub._id) ? prev.filter((id) => id !== sub._id) : [...prev, sub._id]
                                )
                              }}
                              className="rounded border-slate-600 bg-slate-800 accent-amber-500"
                            />
                            {lang === 'ar' ? (sub.title_ar || sub.title_en) : (sub.title_en || sub.title_ar)}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {t('Business name', 'اسم العمل')}
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={t('e.g. My Restaurant', 'مثال: مطعمي')}
                  className="dashboard-input border-slate-600 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {t('Your mobile / WhatsApp number', 'رقم جوالك / واتساب')} <span className="text-slate-500">({t('Optional', 'اختياري')})</span>
                </label>
                <Input
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+972 50 123 4567"
                  className="dashboard-input border-slate-600 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  {t('Leave blank to use your verified number. Or enter a different number for this business.', 'اتركه فارغاً لاستخدام رقمك المؤكد. أو أدخل رقماً مختلفاً لهذا العمل.')}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {t('URL slug', 'رابط الموقع')}
                </label>
                <Input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-restaurant"
                  className="dashboard-input font-mono border-slate-600 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {t('Your menu will be at:', 'ستكون قائمتك على:')} <span className="font-mono text-slate-400">/t/{slug || 'your-slug'}</span>
                </p>
              </div>

              {/* Rules & privacy — visible checkbox for tenants */}
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 ring-2 ring-amber-500/20">
                <label className="flex cursor-pointer items-start gap-4 text-slate-200">
                  <input
                    type="checkbox"
                    checked={rulesAcknowledged}
                    onChange={(e) => setRulesAcknowledged(e.target.checked)}
                    className="mt-1 size-6 min-h-6 min-w-6 shrink-0 cursor-pointer rounded border-2 border-amber-400/60 bg-slate-800 text-amber-500 accent-amber-500 focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                    aria-describedby="tenant-rules-desc"
                  />
                  <span id="tenant-rules-desc" className="text-base leading-relaxed">
                    {t('I have read and agree to the rules and ', 'لقد قرأت وأوافق على قواعد و ')}
                    <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-amber-300 hover:text-amber-200">
                      {t('Privacy Policy', 'سياسة الخصوصية')}
                    </Link>
                    {t(' of this website. I acknowledge that I will comply with them as a business owner.', ' لهذا الموقع. أقر بأنني سألتزم بها كصاحب عمل.')}
                  </span>
                </label>
                <p className="mt-2 text-sm text-amber-200/80">
                  {t('You must check this box to create your business.', 'يجب تحديد هذا المربع لإنشاء عملك.')}
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full min-h-12 text-base bg-amber-500 text-slate-950 hover:bg-amber-400"
                disabled={loading || !rulesAcknowledged}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t('Creating your site…', 'جارٍ إنشاء موقعك…')}
                  </>
                ) : (
                  <>
                    {t('Create my site', 'إنشاء موقعي')}
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center">
            <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">
              ← {t('Back to dashboard', 'العودة للوحة التحكم')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
