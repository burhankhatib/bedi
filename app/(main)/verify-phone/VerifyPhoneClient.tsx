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
type VerificationStrategy = 'prelude_whatsapp' | 'prelude_sms' | 'clerk'

export default function VerifyPhoneClient() {
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, lang } = useLanguage()

  const [step, setStep] = useState<Step>('add')
  const [phoneInput, setPhoneInput] = useState('')
  const [countryCode, setCountryCode] = useState<SupportedCountryCode>('+972')
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [phoneId, setPhoneId] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<VerificationStrategy>('prelude_whatsapp')

  // Normalize returnTo: If driver, redirect to profile to avoid React Error #310 from orders page hydration.
  let rawReturnTo = searchParams.get('returnTo') || '/'
  const normalizedReturnTo = rawReturnTo === '/driver' || rawReturnTo.startsWith('/driver/') 
    ? '/driver/profile' 
    : rawReturnTo

  const intentChange = searchParams.get('intent') === 'change'

  const [prefilled, setPrefilled] = useState(false)

  // Pre-fill from query params (e.g. redirect from driver profile or tenant onboarding) or from Clerk user profile
  useEffect(() => {
    if (prefilled) return

    let digits = ''
    let codeParam = searchParams.get('countryCode')?.trim()
    const phoneParam = searchParams.get('phone')?.trim()
    
    if (phoneParam) {
      digits = phoneParam.replace(/\D/g, '')
    } else if (user?.phoneNumbers && user.phoneNumbers.length > 0) {
      // Find an unverified phone number if available, otherwise just take the first one
      const unverifiedPhone = user.phoneNumbers.find(p => p.verification?.status !== 'verified')
      const phoneToUse = unverifiedPhone || user.phoneNumbers[0]
      if (phoneToUse && phoneToUse.phoneNumber) {
        digits = phoneToUse.phoneNumber.replace(/\D/g, '')
      }
    }

    if (!digits) return

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
    setPrefilled(true)
  }, [searchParams, user, prefilled])

  const hasVerified = user?.phoneNumbers?.some(
    (p) => (p as { verification?: { status?: string | null } | null }).verification?.status === 'verified'
  )

  useEffect(() => {
    if (user && hasVerified && !intentChange) {
      window.location.href = normalizedReturnTo
    }
  }, [user, hasVerified, normalizedReturnTo, intentChange])

  if (user && hasVerified && !intentChange) {
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

  const handleSendCode = async (startingStrategy: VerificationStrategy = 'prelude_whatsapp') => {
    setError('')
    const raw = phoneInput.trim()
    if (!raw) {
      setError(lang === 'ar' ? 'أدخل رقم الهاتف' : 'Enter your phone number')
      return
    }
    if (!user) return
    setLoading(true)

    const phoneNumber = ensureE164(raw, countryCode)

    // Find if phone already exists in Clerk
    let phoneObj = user.phoneNumbers.find(p => p.phoneNumber === phoneNumber)
    
    if (phoneObj && phoneObj.verification?.status === 'verified') {
      if (intentChange) {
        setError(lang === 'ar' ? 'هذا الرقم مؤكد مسبقاً. يرجى إدخال رقم جديد لتغييره.' : 'This number is already verified. Please enter a new number to change it.')
        setLoading(false)
        return
      }
      setStep('done')
      setTimeout(() => {
        window.location.href = normalizedReturnTo
      }, 1500)
      return
    }

    const tryStrategy = async (currentStrategy: VerificationStrategy): Promise<boolean> => {
      setStrategy(currentStrategy)
      try {
        if (currentStrategy === 'clerk') {
          if (!phoneObj) {
            phoneObj = await user.createPhoneNumber({ phoneNumber })
          }
          await phoneObj.prepareVerification()
          setPhoneId(phoneObj.id)
        } else {
          // Best practice: collect browser signals and send dispatchId to backend for fraud context (Prelude Web SDK).
          let dispatchId: string | undefined
          const sdkKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_PRELUDE_SDK_KEY : undefined
          if (sdkKey) {
            try {
              const { dispatchSignals } = await import('@prelude.so/js-sdk/signals')
              dispatchId = await dispatchSignals(sdkKey)
            } catch (err) {
              console.warn('Prelude SDK dispatch failed:', err)
            }
          }

          const channel = currentStrategy === 'prelude_whatsapp' ? 'whatsapp' : 'sms'
          const res = await fetch('/api/verify-phone/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, dispatchId, channel }),
          })

          if (!res.ok) {
            const msg = await res.text()
            throw new Error(msg || 'Failed to request verification code')
          }
        }
        return true
      } catch (e) {
        console.error(`Strategy ${currentStrategy} failed:`, e)
        return false
      }
    }

    // Try strategies in order with automatic fallback
    let success = false
    if (startingStrategy === 'prelude_whatsapp') {
      success = await tryStrategy('prelude_whatsapp')
      if (!success) {
        success = await tryStrategy('prelude_sms')
      }
      if (!success) {
        success = await tryStrategy('clerk')
      }
    } else if (startingStrategy === 'prelude_sms') {
      success = await tryStrategy('prelude_sms')
      if (!success) {
        success = await tryStrategy('clerk')
      }
    } else if (startingStrategy === 'clerk') {
      success = await tryStrategy('clerk')
    }

    setLoading(false)

    if (success) {
      setStep('code')
    } else {
      setError(lang === 'ar' ? 'فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى لاحقاً.' : 'Failed to send verification code. Please try again later.')
    }
  }

  const handleVerifyCode = async () => {
    setError('')
    const code = codeInput.trim()
    if (!code) return
    setLoading(true)
    try {
      if (strategy === 'clerk') {
        if (!user) throw new Error('User not found')
        const phoneObj = user.phoneNumbers.find(p => p.id === phoneId)
        if (!phoneObj) {
          throw new Error('Phone number not found')
        }

        const verifyAttempt = await phoneObj.attemptVerification({ code })
        if (verifyAttempt.verification.status !== 'verified') {
          throw new Error('Invalid code')
        }
        
        // If user has no primary phone number or intent is change, set this as primary
        if (!user.primaryPhoneNumberId || intentChange) {
          await user.update({ primaryPhoneNumberId: phoneObj.id })
        }
      } else {
        const phoneNumber = ensureE164(phoneInput.trim(), countryCode)

        const res = await fetch('/api/verify-phone/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, code, intentChange }),
        })

        if (!res.ok) {
          const msg = await res.text()
          throw new Error(msg || 'Invalid code')
        }
      }

      await user?.reload()
      
      // Sync phone to all user profiles in backend
      try {
        await fetch('/api/verify-phone/sync', { method: 'POST' })
      } catch (err) {
        console.error('Failed to sync phone', err)
      }

      setStep('done')
      setTimeout(() => {
        window.location.href = normalizedReturnTo
      }, 1500)
    } catch (e) {
      // Special handling for Clerk errors
      if (e && typeof e === 'object' && 'errors' in e) {
        const clerkError = (e as any).errors?.[0]?.longMessage || (e as any).errors?.[0]?.message
        if (clerkError) {
          setError(clerkError)
          setLoading(false)
          return
        }
      }
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
            {intentChange 
              ? t('Change your phone number', 'تغيير رقم الهاتف') 
              : t('Verify your phone number', 'تأكيد رقم الهاتف')}
          </h1>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          {intentChange
            ? t('Enter your new number and we\'ll send a verification code. After verification it will be saved as your primary number.', 'أدخل رقمك الجديد وسنرسل لك رمز التحقق. بعد التأكيد سيتم حفظه كرقمك الأساسي.')
            : t('Orders are only accepted from verified numbers. Add your number and enter the code we send you.', 'الطلبات تُقبل فقط من أرقام موثّقة. أضف رقمك وأدخل الرمز الذي نرسله إليك.')}
        </p>
        <p className="text-xs text-slate-500 mb-4">
          {t('Code is sent by SMS (or WhatsApp when available).', 'يُرسل الرمز عبر الرسائل القصيرة (أو واتساب عند التوفّر).')}
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
            <Button onClick={() => handleSendCode('prelude_whatsapp')} disabled={loading} className="w-full bg-amber-600 text-slate-950 hover:bg-amber-700 hover:text-slate-950">
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
              <p className="text-xs text-slate-500 mt-1">
                {strategy === 'prelude_whatsapp' 
                  ? t('Sent via WhatsApp', 'تم الإرسال عبر واتساب')
                  : strategy === 'prelude_sms'
                    ? t('Sent via SMS', 'تم الإرسال عبر رسالة نصية قصيرة')
                    : t('Sent via SMS (Alternate)', 'تم الإرسال عبر رسالة نصية (بديل)')}
              </p>
            </div>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t('Enter verification code', 'أدخل رمز التحقق')}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="mb-3"
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <Button onClick={handleVerifyCode} disabled={loading || codeInput.length < 4} className="w-full bg-amber-600 text-slate-950 hover:bg-amber-700 hover:text-slate-950">
              {loading ? t('Verifying…', 'جاري التحقق…') : t('Verify', 'تحقق')}
            </Button>
            
            <div className="mt-4 flex flex-col gap-2">
              {strategy === 'prelude_whatsapp' && (
                <Button variant="outline" size="sm" onClick={() => handleSendCode('prelude_sms')} disabled={loading}>
                  {t("Didn't receive a WhatsApp? Resend via SMS", 'لم يصلك الرمز على واتساب؟ أرسل رسالة نصية')}
                </Button>
              )}
              {strategy === 'prelude_sms' && (
                <Button variant="outline" size="sm" onClick={() => handleSendCode('clerk')} disabled={loading}>
                  {t("Didn't receive an SMS? Try alternate provider", 'لم تصلك رسالة نصية؟ جرب مزود بديل')}
                </Button>
              )}
              
              <Button variant="ghost" size="sm" className="w-full" onClick={() => { setStep('add'); setCodeInput(''); setError(''); }}>
                {t('Use a different number', 'استخدام رقم آخر')}
              </Button>
            </div>
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
