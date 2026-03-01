'use client'

import { useState } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { getAllowedRedirectPath } from '@/lib/auth-utils'
import { Phone, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

/** Normalize raw input to E.164 (default +972 for IL/PS). */
function ensureE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('972')) return `+${digits}`
  if (digits.startsWith('970')) return `+${digits}`
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`
  return `+972${digits}`
}

/**
 * Phone-only sign-in: enter phone → verification code is sent immediately →
 * enter code → signed in. No extra step.
 */
export default function SignInPhoneDirectClient() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = getAllowedRedirectPath(searchParams.get('redirect_url'), '/')
  const { t, lang } = useLanguage()

  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSendCode = async () => {
    setError('')
    const raw = phoneInput.trim()
    if (!raw) {
      setError(lang === 'ar' ? 'أدخل رقم الهاتف' : 'Enter your phone number')
      return
    }
    if (!signIn || !isLoaded) return
    setLoading(true)
    try {
      const phoneNumber = ensureE164(raw)
      await signIn.create({ identifier: phoneNumber })
      const phoneFactor = signIn.supportedFirstFactors?.find((f) => f.strategy === 'phone_code') as
        | { strategy: 'phone_code'; phoneNumberId: string }
        | undefined
      const phoneNumberId = phoneFactor?.phoneNumberId
      if (!phoneNumberId) {
        throw new Error(lang === 'ar' ? 'لم يتم العثور على خيار التحقق بالهاتف.' : 'Phone verification option not found.')
      }
      await signIn.prepareFirstFactor({ strategy: 'phone_code', phoneNumberId })
      setStep('code')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const isPhoneNotEnabled = /identifier|appropriate settings|Clerk Dashboard/i.test(msg)
      const isCountryNotSupported = /not supported|from this country/i.test(msg)
      setError(
        isPhoneNotEnabled
          ? (lang === 'ar'
            ? 'تسجيل الدخول بالهاتف غير مفعّل. فعّل "الهاتف" في لوحة Clerk.'
            : 'Phone sign-in is not enabled. Enable "Phone" in the Clerk Dashboard.')
          : isCountryNotSupported
            ? (lang === 'ar'
              ? 'أرقام هذا البلد غير مفعّلة. فعّل إسرائيل (+972) وفلسطين (+970) في لوحة Clerk.'
              : 'This country is not enabled. Add Israel (+972) and Palestine (+970) in Clerk Dashboard.')
            : msg
      )
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    setError('')
    const code = codeInput.trim()
    if (!code || !signIn) return
    setLoading(true)
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'phone_code', code })
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        router.replace(redirectUrl)
      } else {
        setError(lang === 'ar' ? 'لم يكتمل تسجيل الدخول.' : 'Sign-in did not complete. Please try again.')
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
            {t('Sign in', 'تسجيل الدخول')}
          </h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          {t('Enter your phone number. We’ll send you a verification code.', 'أدخل رقم هاتفك. سنرسل لك رمز التحقق.')}
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
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-2">
                {t('Enter the 6-digit code we sent via SMS to', 'أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه عبر رسالة SMS إلى')} <span className="font-mono text-white" dir="ltr">{ensureE164(phoneInput)}</span>
              </p>
              <p className="text-xs text-amber-500/90 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 leading-relaxed">
                {t('Note: The code is sent via standard SMS (Text Message), NOT WhatsApp. If you don\'t receive it, try using the +970 country code instead of +972 or wait a few minutes.', 'ملاحظة: يتم إرسال الرمز عبر رسالة نصية قصيرة (SMS) وليس واتساب. إذا لم يصلك، ارجع للوراء وجرب استخدام المفتاح +970 بدلاً من +972 أو انتظر بضع دقائق.')}
              </p>
            </div>
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
              {loading ? t('Signing in…', 'جاري تسجيل الدخول…') : t('Verify and sign in', 'تحقق وتسجيل الدخول')}
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

        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col gap-2">
          <Link
            href={redirectUrl}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Back', 'رجوع')}
          </Link>
          <Link
            href={`/sign-up-phone?redirect_url=${encodeURIComponent(redirectUrl)}`}
            className="text-sm text-slate-400 hover:text-amber-400"
          >
            {t('Don’t have an account? Sign up', 'ليس لديك حساب؟ إنشاء حساب')}
          </Link>
        </div>
      </div>
    </div>
  )
}
