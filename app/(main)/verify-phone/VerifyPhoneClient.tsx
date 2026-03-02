'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { Phone, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Step = 'add' | 'code' | 'done'
type SupportedCountryCode = '+970' | '+972'

export default function VerifyPhoneClient() {
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/'
  const { t, lang } = useLanguage()

  const [step, setStep] = useState<Step>('add')
  const [phoneInput, setPhoneInput] = useState('')
  const [countryCode, setCountryCode] = useState<SupportedCountryCode>('+972')
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Pre-fill from query params (e.g. redirect from driver profile or tenant onboarding)
  useEffect(() => {
    const phoneParam = searchParams.get('phone')?.trim()
    const codeParam = searchParams.get('countryCode')?.trim()
    if (!phoneParam) return
    const digits = phoneParam.replace(/\D/g, '')
    if (digits.startsWith('970')) {
      setCountryCode('+970')
      setPhoneInput(digits.slice(3).replace(/^0+/, '') || digits.slice(3))
    } else if (digits.startsWith('972')) {
      setCountryCode('+972')
      setPhoneInput(digits.slice(3).replace(/^0+/, '') || digits.slice(3))
    } else {
      if (codeParam === '+970') setCountryCode('+970')
      else if (codeParam === '+972') setCountryCode('+972')
      setPhoneInput(digits.startsWith('0') ? digits.slice(1) : digits)
    }
  }, [searchParams])

  const hasVerified = user?.phoneNumbers?.some(
    (p) => (p as { verification?: { status?: string | null } | null }).verification?.status === 'verified'
  )

  useEffect(() => {
    if (user && hasVerified) {
      window.location.href = returnTo
    }
  }, [user, hasVerified, returnTo])

  if (user && hasVerified) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6">
        <p className="text-slate-600">{t('Redirecting…', 'جاري التوجيه…')}</p>
      </div>
    )
  }

  const ensureE164 = (raw: string, selectedCode: SupportedCountryCode) => {
    const selectedDigits = selectedCode.replace('+', '')
    let digits = raw.replace(/\D/g, '')

    // If user typed country code manually, keep local part only.
    if (digits.startsWith(selectedDigits)) {
      digits = digits.slice(selectedDigits.length)
    }
    // Local mobile numbers often start with 0; remove it to build E.164.
    if (digits.startsWith('0')) {
      digits = digits.slice(1)
    }

    return `${selectedCode}${digits}`
  }

  const handleSendCode = async () => {
    setError('')
    const raw = phoneInput.trim()
    if (!raw) {
      setError(lang === 'ar' ? 'أدخل رقم الهاتف' : 'Enter your phone number')
      return
    }
    if (!user) return
    setLoading(true)
    try {
      const phoneNumber = ensureE164(raw, countryCode)

      let dispatchId: string | undefined
      const sdkKey = process.env.NEXT_PUBLIC_PRELUDE_SDK_KEY
      if (sdkKey) {
        try {
          const { dispatchSignals } = await import('@prelude.so/js-sdk/signals')
          dispatchId = await dispatchSignals(sdkKey)
        } catch (err) {
          console.warn('Prelude SDK dispatch failed:', err)
        }
      }

      const res = await fetch('/api/verify-phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, dispatchId }),
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Failed to request verification code')
      }

      setStep('code')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    setError('')
    const code = codeInput.trim()
    if (!code) return
    setLoading(true)
    try {
      const phoneNumber = ensureE164(phoneInput.trim(), countryCode)

      const res = await fetch('/api/verify-phone/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code }),
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Invalid code')
      }

      await user?.reload()
      setStep('done')
      setTimeout(() => {
        window.location.href = returnTo
      }, 1500)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid code'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-lg p-6">
        <div className="flex items-center gap-3 text-slate-800 mb-6">
          <Phone className="h-8 w-8 text-amber-600" />
          <h1 className="text-xl font-bold">
            {t('Verify your phone number', 'تأكيد رقم الهاتف')}
          </h1>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          {t('Orders are only accepted from verified numbers. Add your number and enter the code we send you.', 'الطلبات تُقبل فقط من أرقام موثّقة. أضف رقمك وأدخل الرمز الذي نرسله إليك.')}
        </p>

        {step === 'add' && (
          <>
            <div className="mb-3 flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value as SupportedCountryCode)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                aria-label={t('Country code', 'مفتاح الدولة')}
              >
                <option value="+972">{t('Israel (+972)', 'إسرائيل (+972)')}</option>
                <option value="+970">{t('Palestine (+970)', 'فلسطين (+970)')}</option>
              </select>
              <Input
                type="tel"
                placeholder={lang === 'ar' ? 'مثال: 0501234567' : 'e.g. 0501234567'}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="flex-1"
              />
            </div>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <Button onClick={handleSendCode} disabled={loading} className="w-full bg-amber-600 text-slate-950 hover:bg-amber-700 hover:text-slate-950">
              {loading ? t('Sending…', 'جاري الإرسال…') : t('Send verification code', 'إرسال رمز التحقق')}
            </Button>
          </>
        )}

        {step === 'code' && (
          <>
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-1">
                {t('Enter the verification code we sent to', 'أدخل رمز التحقق الذي أرسلناه إلى')} <span className="font-mono font-medium" dir="ltr">{ensureE164(phoneInput, countryCode)}</span>
              </p>
            </div>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t('Enter verification code', 'أدخل رمز التحقق')}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 10))} // Allow up to 10 just in case Prelude uses longer codes, though usually 5-6
              className="mb-3"
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <Button onClick={handleVerifyCode} disabled={loading || codeInput.length < 4} className="w-full bg-amber-600 text-slate-950 hover:bg-amber-700 hover:text-slate-950">
              {loading ? t('Verifying…', 'جاري التحقق…') : t('Verify', 'تحقق')}
            </Button>
            <Button variant="ghost" className="w-full mt-2" onClick={() => { setStep('add'); setCodeInput(''); setError(''); }}>
              {t('Use a different number', 'استخدام رقم آخر')}
            </Button>
          </>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 text-emerald-600">
            <CheckCircle2 className="h-12 w-12" />
            <p className="font-semibold">{t('Phone verified!', 'تم تأكيد الهاتف!')}</p>
            <p className="text-sm text-slate-600">{t('Redirecting…', 'جاري التوجيه…')}</p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            {t('Back to homepage', 'العودة للصفحة الرئيسية')}
          </Link>
        </div>
      </div>
    </div>
  )
}
