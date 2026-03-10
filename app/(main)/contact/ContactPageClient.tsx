'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { AppNav } from '@/components/saas/AppNav'
import { PublicFooter } from '@/components/saas/PublicFooter'
import { useLanguage } from '@/components/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, Send, User, Building2, Truck } from 'lucide-react'
import { getCountryNameAr, getCityNameAr } from '@/lib/registration-translations'

type ContactType = 'customer' | 'driver' | 'business'

const CONTACT_TYPES: { value: ContactType; labelEn: string; labelAr: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'customer', labelEn: 'Customer', labelAr: 'عميل', Icon: User },
  { value: 'driver', labelEn: 'Driver', labelAr: 'سائق', Icon: Truck },
  { value: 'business', labelEn: 'Business', labelAr: 'أعمال', Icon: Building2 },
]

export function ContactPageClient() {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'
  const { user, isLoaded: userLoaded } = useUser()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [type, setType] = useState<ContactType>('customer')
  const [businessName, setBusinessName] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([])
  const [cities, setCities] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/countries')
      .then((r) => r.json())
      .then((list) => setCountries(Array.isArray(list) ? list : []))
      .catch(() => setCountries([]))
  }, [])

  useEffect(() => {
    if (!country) {
      setCities([])
      return
    }
    fetch(`/api/cities?country=${encodeURIComponent(country)}`)
      .then((r) => r.json())
      .then((list) => setCities(Array.isArray(list) ? list : []))
      .catch(() => setCities([]))
  }, [country])

  useEffect(() => {
    if (!userLoaded || !user) return
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    if (fullName) setName(fullName)
    const primaryEmail = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress
    if (primaryEmail) setEmail(primaryEmail)
    const primaryPhone = user.primaryPhoneNumber?.phoneNumber ?? user.phoneNumbers?.[0]?.phoneNumber
    if (primaryPhone) setPhone(primaryPhone)
    const meta = user.publicMetadata as { city?: string; country?: string } | undefined
    if (meta?.city) setCity(meta.city)
    if (meta?.country) setCountry(meta.country)
  }, [userLoaded, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError(t('Name is required', 'الاسم مطلوب'))
      return
    }
    if (!phone.trim()) {
      setError(t('Phone is required', 'رقم الهاتف مطلوب'))
      return
    }
    if (!message.trim()) {
      setError(t('Message is required', 'الرسالة مطلوبة'))
      return
    }
    const emailTrim = email.trim()
    if (!emailTrim) {
      setError(t('Email is required', 'البريد الإلكتروني مطلوب'))
      return
    }
    if (type === 'business' && !businessName.trim()) {
      setError(t('Business name is required when you select Business', 'اسم العمل مطلوب عند اختيار أعمال'))
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: emailTrim,
          phone: phone.trim(),
          city: city.trim(),
          country: country.trim(),
          type,
          ...(type === 'business' ? { businessName: businessName.trim() } : {}),
          message: message.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? t('Failed to send', 'فشل الإرسال'))
        return
      }
      setSent(true)
    } catch {
      setError(t('Failed to send', 'فشل الإرسال'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white" dir={isRtl ? 'rtl' : 'ltr'} lang={lang === 'ar' ? 'ar' : 'en'}>
      <AppNav
        variant="landing"
        signInLabel={t('Sign in', 'تسجيل الدخول')}
        getStartedLabel={t('Get started', 'ابدأ مجاناً')}
        trailingElement={<LanguageSwitcher />}
      />

      <main className="border-b border-slate-800/50">
        <section className="relative overflow-hidden border-b border-slate-800/50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.08),transparent)]" />
          <div className="container relative mx-auto px-4 py-10 md:py-14">
            <Link
              href="/join"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-amber-400 focus:text-amber-400 focus:outline-none"
            >
              <ChevronLeft className="size-4 shrink-0" style={isRtl ? { transform: 'scaleX(-1)' } : undefined} />
              {t('Back to Bedi Delivery', 'العودة إلى Bedi Delivery')}
            </Link>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl">
              {t('Contact us', 'تواصل معنا')}
            </h1>
            <p className="mt-2 text-slate-400">
              {t('Send us a message and we’ll get back to you.', 'أرسل رسالتك وسنتواصل معك.')}
            </p>
            <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">{t('Business name', 'اسم العمل')}: Bedi Delivery</p>
              <p className="mt-1">{t('Address', 'العنوان')}: University Street, Bethany, 9144002, Palestine</p>
              <p className="mt-1">{t('Phone', 'الهاتف')}: +970 56 961 1116</p>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-14">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-lg">
              {/* Android/Material-style card: light surface, elevation, rounded */}
              <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="p-6 md:p-8">
                  {sent ? (
                    <div className="rounded-xl bg-emerald-50 p-6 text-center text-emerald-800">
                      <p className="font-medium">
                        {t('Message sent successfully. We’ll get back to you soon.', 'تم إرسال رسالتك. سنتواصل معك قريباً.')}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                        onClick={() => { setSent(false); setMessage('') }}
                      >
                        {t('Send another', 'إرسال رسالة أخرى')}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {error && (
                        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
                      )}

                      {/* Name */}
                      <div>
                        <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('Name', 'الاسم')} *
                        </label>
                        <Input
                          id="contact-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-12 rounded-xl border-0 bg-slate-100 text-slate-900 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-amber-500"
                          placeholder={t('Your name', 'اسمك')}
                          required
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label htmlFor="contact-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('Mobile / Primary phone', 'الجوال / الهاتف الأساسي')} *
                        </label>
                        <Input
                          id="contact-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="h-12 rounded-xl border-0 bg-slate-100 text-slate-900 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-amber-500"
                          placeholder={t('+972... or 05...', '+972... أو 05...')}
                          required
                        />
                      </div>

                      {/* Email — required; pre-filled when logged in */}
                      <div>
                        <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('Email', 'البريد الإلكتروني')} *
                        </label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-12 rounded-xl border-0 bg-slate-100 text-slate-900 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-amber-500"
                          placeholder={t('your@email.com', 'your@email.com')}
                          required
                        />
                        {user && (
                          <p className="mt-1 text-xs text-slate-500">
                            {t('Using your account email', 'باستخدام بريد حسابك')}
                          </p>
                        )}
                      </div>

                      {/* Country */}
                      <div>
                        <label htmlFor="contact-country" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('Country', 'البلد')}
                        </label>
                        <select
                          id="contact-country"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="h-12 w-full appearance-none rounded-xl border-0 bg-slate-100 pl-4 pr-10 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:ring-offset-0"
                        >
                          <option value="">{t('Select country', 'اختر البلد')}</option>
                          {countries.map((c) => (
                            <option key={c.code} value={c.code}>
                              {lang === 'ar' ? (getCountryNameAr(c.code) ?? c.name) : c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* City */}
                      <div>
                        <label htmlFor="contact-city" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('City', 'المدينة')}
                        </label>
                        <select
                          id="contact-city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="h-12 w-full appearance-none rounded-xl border-0 bg-slate-100 pl-4 pr-10 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:ring-offset-0"
                          disabled={!country}
                        >
                          <option value="">{t('Select city', 'اختر المدينة')}</option>
                          {cities.map((c) => (
                            <option key={c} value={c}>
                              {lang === 'ar' ? (getCityNameAr(c) ?? c) : c}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Type: Customer / Driver / Business — Material radio style */}
                      <div>
                        <p className="mb-3 text-sm font-medium text-slate-700">
                          {t('I am a', 'أنا')} *
                        </p>
                        <div className="flex flex-col gap-2">
                          {CONTACT_TYPES.map(({ value: v, labelEn: le, labelAr: la, Icon }) => (
                            <label
                              key={v}
                              className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 px-4 py-3 transition-colors ${
                                type === v
                                  ? 'border-amber-500 bg-amber-50'
                                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name="contact-type"
                                value={v}
                                checked={type === v}
                                onChange={() => setType(v)}
                                className="size-5 shrink-0 accent-amber-500"
                              />
                              <Icon className="size-5 shrink-0 text-slate-600" />
                              <span className="text-slate-800">{lang === 'ar' ? la : le}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Business name — conditional */}
                      {type === 'business' && (
                        <div>
                          <label htmlFor="contact-business" className="mb-1.5 block text-sm font-medium text-slate-700">
                            {t('Business name', 'اسم العمل')} *
                          </label>
                          <Input
                            id="contact-business"
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="h-12 rounded-xl border-0 bg-slate-100 text-slate-900 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-amber-500"
                            placeholder={t('Your business or restaurant name', 'اسم عملك أو مطعمك')}
                            required
                          />
                        </div>
                      )}

                      {/* Message */}
                      <div>
                        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('Message', 'الرسالة')} *
                        </label>
                        <textarea
                          id="contact-message"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                          className="w-full resize-y rounded-xl border-0 bg-slate-100 px-4 py-3 text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:ring-offset-0"
                          placeholder={t('How can we help?', 'كيف يمكننا المساعدة؟')}
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={sending}
                        className="h-12 w-full rounded-xl bg-amber-500 text-base font-medium text-slate-950 shadow-md hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-70"
                      >
                        {sending ? (
                          t('Sending…', 'جاري الإرسال…')
                        ) : (
                          <>
                            <Send className="size-5 shrink-0" />
                            {t('Send message', 'إرسال الرسالة')}
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
