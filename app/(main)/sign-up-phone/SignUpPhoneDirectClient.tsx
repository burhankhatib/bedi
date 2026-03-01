'use client'

import { useState, useEffect } from 'react'
import { useSignUp } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { getAllowedRedirectPath } from '@/lib/auth-utils'
import { Phone, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Step = 'phone' | 'code' | 'done'

/** Normalize raw input to E.164 (default +972 for IL/PS). */
function ensureE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('972')) return `+${digits}`
  if (digits.startsWith('970')) return `+${digits}`
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`
  return `+972${digits}`
}

/**
 * Phone-only sign-up: enter phone → verification code is sent immediately →
 * enter code → account created and session set. No second "add phone" step.
 * Use this route when Clerk is configured for phone-only sign-up/sign-in.
 */
export default function SignUpPhoneDirectClient() {
  const { signUp, setActive, isLoaded } = useSignUp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = getAllowedRedirectPath(searchParams.get('redirect_url'), '/')
  const { t, lang } = useLanguage()

  const [step, setStep] = useState<Step>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If user is already signed in (e.g. navigated here by mistake), redirect
  useEffect(() => {
    if (!isLoaded) return
    if (signUp?.status === 'complete' && signUp.createdSessionId) {
      setActive({ session: signUp.createdSessionId }).then(() => {
        router.replace(redirectUrl)
      })
      return
    }
  }, [isLoaded, signUp?.status, signUp?.createdSessionId, setActive, router, redirectUrl])

  const handleSendCode = async () => {
    setError('')
    const raw = phoneInput.trim()
    if (!raw) {
      setError(lang === 'ar' ? 'أدخل رقم الهاتف' : 'Enter your phone number')
      return
    }
    if (!signUp || !isLoaded) return
    setLoading(true)
    try {
      const phoneNumber = ensureE164(raw)
      await signUp.create({ phoneNumber })
      await signUp.preparePhoneNumberVerification()
      setStep('code')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const isPhoneNotEnabled = /phone_number is not a valid parameter|appropriate settings are enabled in the Clerk Dashboard/i.test(msg)
      const isCountryNotSupported = /not supported|from this country/i.test(msg)
      const isAlreadyInUse = /already in use|already used|linked to another|another (user|account|person)/i.test(msg)
      setError(
        isPhoneNotEnabled
          ? (lang === 'ar'
            ? 'إضافة رقم الهاتف غير مفعّلة في الإعدادات. فعّل "الهاتف" في لوحة Clerk (User & Authentication → Phone).'
            : 'Phone number is not enabled. Enable "Phone" in the Clerk Dashboard under User & Authentication → Phone.')
          : isCountryNotSupported
            ? (lang === 'ar'
              ? 'أرقام هذا البلد غير مفعّلة. فعّل إسرائيل (+972) وفلسطين (+970) في لوحة Clerk.'
              : 'This country is not enabled. In Clerk Dashboard go to User & Authentication → Phone → Allowed countries and add Israel (+972) and Palestine (+970).')
            : isAlreadyInUse
              ? (lang === 'ar'
                ? 'هذا الرقم مرتبط بحساب آخر. سجّل الدخول أو استخدم رقماً آخر.'
                : 'This number is linked to another account. Sign in or use a different number.')
              : msg
      )
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    setError('')
    const code = codeInput.trim()
    if (!code || !signUp) return
    setLoading(true)
    try {
      await signUp.attemptPhoneNumberVerification({ code })
      if (signUp.status === 'complete' && signUp.createdSessionId) {
        await setActive({ session: signUp.createdSessionId })
        setStep('done')
        setTimeout(() => router.replace(redirectUrl), 1200)
      } else {
        setError(lang === 'ar' ? 'لم يكتمل التسجيل. حاول مرة أخرى.' : 'Sign-up did not complete. Please try again.')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid code'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <p className="text-slate-400">{t('Loading…', 'جاري التحميل…')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-xl p-6">
        <div className="flex items-center gap-3 text-slate-100 mb-6">
          <Phone className="h-8 w-8 text-amber-500 shrink-0" />
          <h1 className="text-xl font-bold">
            {t('Create account', 'إنشاء حساب')}
          </h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          {t('Enter your phone number. We’ll send you a verification code right away.', 'أدخل رقم هاتفك. سنرسل لك رمز التحقق فوراً.')}
        </p>

        {step === 'phone' && (
          <>
            <Input
              type="tel"
              placeholder={lang === 'ar' ? 'مثال: 0501234567' : 'e.g. 0501234567'}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="mb-3 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              autoComplete="tel"
            />
            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <Button
              onClick={handleSendCode}
              disabled={loading}
              className="w-full bg-amber-600 text-slate-950 hover:bg-amber-500 font-semibold"
            >
              {loading ? t('Sending code…', 'جاري إرسال الرمز…') : t('Send verification code', 'إرسال رمز التحقق')}
            </Button>
          </>
        )}

        {step === 'code' && (
          <>
            <p className="text-sm text-slate-400 mb-3">
              {t('Enter the 6-digit code we sent to', 'أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى')} <span className="font-mono text-white" dir="ltr">{ensureE164(phoneInput)}</span>
            </p>
            <Input
              type="text"
              inputMode="numeric"
              placeholder={t('Enter 6-digit code', 'أدخل الرمز المكوّن من 6 أرقام')}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mb-3 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              autoComplete="one-time-code"
            />
            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <Button
              onClick={handleVerifyCode}
              disabled={loading || codeInput.length < 4}
              className="w-full bg-amber-600 text-slate-950 hover:bg-amber-500 font-semibold"
            >
              {loading ? t('Verifying…', 'جاري التحقق…') : t('Verify and create account', 'تحقق وإنشاء الحساب')}
            </Button>
            <Button
              variant="ghost"
              className="w-full mt-2 text-slate-400 hover:text-slate-200"
              onClick={() => {
                setStep('phone')
                setCodeInput('')
                setError('')
              }}
            >
              {t('Use a different number', 'استخدام رقم آخر')}
            </Button>
          </>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 text-emerald-400 py-4">
            <CheckCircle2 className="h-12 w-12" />
            <p className="font-semibold">{t('Account created!', 'تم إنشاء الحساب!')}</p>
            <p className="text-sm text-slate-400">{t('Redirecting…', 'جاري التوجيه…')}</p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col gap-2">
          <Link
            href={redirectUrl}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Back', 'رجوع')}
          </Link>
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
            className="text-sm text-slate-400 hover:text-amber-400"
          >
            {t('Already have an account? Sign in', 'لديك حساب؟ تسجيل الدخول')}
          </Link>
        </div>
      </div>
    </div>
  )
}
