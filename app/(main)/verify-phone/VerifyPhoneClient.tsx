'use client'

import { useState, useEffect } from 'react'
import { useUser, useReverification } from '@clerk/nextjs'
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

  // Clerk requires reverification (e.g. password or email code) before adding a phone. This hook shows the modal and retries.
  const createPhoneNumberWithReverification = useReverification(
    (phone: string) => (user ? user.createPhoneNumber({ phoneNumber: phone }) : Promise.resolve(undefined))
  )

  const [step, setStep] = useState<Step>('add')
  const [phoneInput, setPhoneInput] = useState('')
  const [countryCode, setCountryCode] = useState<SupportedCountryCode>('+972')
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingPhoneResource, setPendingPhoneResource] = useState<{ prepareVerification: (p?: { strategy: string }) => Promise<unknown>; attemptVerification: (p: { code: string }) => Promise<unknown> } | null>(null)

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

  if (user && hasVerified) {
    router.replace(returnTo)
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

  /** Normalize to digits only for comparison with Clerk phone numbers. */
  const toCompareDigits = (phone: string) => phone.replace(/\D/g, '')

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
      const inputDigits = toCompareDigits(phoneNumber)

      // If this number is already on the user's account, verify it instead of creating again (avoids "already in use" and links verification to Clerk).
      const existing = user.phoneNumbers?.find((p) => {
        const pn = (p as { phoneNumber?: string }).phoneNumber
        return pn && toCompareDigits(pn) === inputDigits
      }) as { id?: string; verification?: { status?: string }; prepareVerification: (p?: { strategy: string }) => Promise<unknown>; attemptVerification: (p: { code: string }) => Promise<unknown> } | undefined

      if (existing) {
        if (existing.verification?.status === 'verified') {
          setStep('done')
          setTimeout(() => router.replace(returnTo), 800)
          return
        }
        // Existing but unverified: send code to this number (no create, so no "already in use").
        await existing.prepareVerification({ strategy: 'phone_code' })
        setPendingPhoneResource(existing)
        setStep('code')
        return
      }

      // New number: create then send code (may trigger Clerk reverification modal).
      const res = await createPhoneNumberWithReverification(phoneNumber)
      if (!res) throw new Error('Could not add phone number')
      await user.reload()
      const newPhone = user.phoneNumbers?.find((p) => (p as { id?: string }).id === (res as { id?: string }).id) as { prepareVerification: (p?: { strategy: string }) => Promise<unknown>; attemptVerification: (p: { code: string }) => Promise<unknown> } | undefined
      if (!newPhone) throw new Error('Could not send code')
      await newPhone.prepareVerification({ strategy: 'phone_code' })
      setPendingPhoneResource(newPhone)
      setStep('code')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const isPhoneNotEnabled = /phone_number is not a valid parameter|appropriate settings are enabled in the Clerk Dashboard/i.test(msg)
      const isCountryNotSupported = /not supported|from this country/i.test(msg)
      const isAlreadyInUse = /already in use|already used|linked to another|another (user|account|person)/i.test(msg)
      const hasEmailNoPhone = (user?.emailAddresses?.length ?? 0) > 0 && !user?.phoneNumbers?.some((p) => (p as { verification?: { status?: string } }).verification?.status === 'verified')
      const reverificationHint = hasEmailNoPhone
        ? (lang === 'ar'
          ? ' إذا سجّلت بالبريد، قد يُطلب منك تأكيد هويتك (كلمة المرور أو رمز البريد) قبل إرسال الرسالة.'
          : ' If you signed up with email, you may need to confirm your identity (e.g. enter your password) before we can send the SMS.')
        : ''
      setError(
        isPhoneNotEnabled
          ? (lang === 'ar'
            ? 'إضافة رقم الهاتف غير مفعّلة في الإعدادات. يرجى تفعيل "الهاتف" و"إضافة هاتف للحساب" من لوحة Clerk (User & Authentication → Phone).'
            : 'Phone number is not enabled in this app\'s settings. Please enable "Phone" and "Add phone to account" in the Clerk Dashboard under User & Authentication → Phone.')
          : isCountryNotSupported
            ? (lang === 'ar'
              ? 'أرقام هذا البلد غير مفعّلة حالياً. فعّل إسرائيل (+972) وفلسطين (+970) في لوحة Clerk: User & Authentication → Phone → Allowed countries.'
              : 'This country is not enabled for phone verification. In the Clerk Dashboard go to User & Authentication → Phone → Allowed countries and add Israel (+972) and Palestine (+970).')
            : isAlreadyInUse
              ? (lang === 'ar'
                ? 'هذا الرقم مرتبط بحساب آخر. سجّل الدخول بالحساب الذي يملك هذا الرقم، أو استخدم رقماً آخر. إذا كان هذا رقمك الوحيد، تواصل مع الدعم.'
                : 'This number is linked to another account. Sign in with the account that has this number, or use a different number. If this is your only number, contact support.')
              : msg
      ) + reverificationHint
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    setError('')
    const code = codeInput.trim()
    if (!code || !pendingPhoneResource) return
    setLoading(true)
    try {
      await pendingPhoneResource.attemptVerification({ code })
      await user?.reload()
      setStep('done')
      setTimeout(() => router.replace(returnTo), 1500)
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
          {t('Orders are only accepted from verified numbers. Add your number and enter the code we send by SMS.', 'الطلبات تُقبل فقط من أرقام موثّقة. أضف رقمك وأدخل الرمز المرسل عبر الرسائل.')}
        </p>
        <p className="text-xs text-slate-500 mb-4">
          {t('You may be asked to confirm your identity (e.g. password or email code) before sending the SMS.', 'قد يُطلب منك تأكيد هويتك (كلمة المرور أو رمز البريد) قبل إرسال الرسالة.')}
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
                {t('Enter the 6-digit code we sent via SMS to', 'أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه عبر رسالة SMS إلى')} <span className="font-mono font-medium" dir="ltr">{ensureE164(phoneInput, countryCode)}</span>
              </p>
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md border border-amber-200">
                {t('Note: The code is sent via standard SMS (Text Message), NOT WhatsApp. If you don\'t receive it, try using the +970 country code or wait a few minutes.', 'ملاحظة: يتم إرسال الرمز عبر رسالة نصية قصيرة (SMS) وليس واتساب. إذا لم يصلك، جرب استخدام مفتاح فلسطين +970 أو انتظر بضع دقائق.')}
              </p>
            </div>
            <Input
              type="text"
              inputMode="numeric"
              placeholder={t('Enter 6-digit code', 'أدخل الرمز المكوّن من 6 أرقام')}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mb-3"
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <Button onClick={handleVerifyCode} disabled={loading || codeInput.length < 4} className="w-full bg-amber-600 text-slate-950 hover:bg-amber-700 hover:text-slate-950">
              {loading ? t('Verifying…', 'جاري التحقق…') : t('Verify', 'تحقق')}
            </Button>
            <Button variant="ghost" className="w-full mt-2" onClick={() => { setStep('add'); setPendingPhoneResource(null); setCodeInput(''); setError(''); }}>
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
          <Link href={returnTo} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            {t('Back', 'رجوع')}
          </Link>
        </div>
      </div>
    </div>
  )
}
