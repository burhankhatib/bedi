'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { Phone, ArrowLeft, CheckCircle2, RefreshCw, Globe, MessageSquare, Clock } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import Link from 'next/link'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'

type Step = 'add' | 'code' | 'done'
type SupportedCountryCode = '+970' | '+972'
type VerificationStrategy = 'meta_whatsapp' | 'prelude_whatsapp' | 'prelude_sms' | 'clerk'

export default function VerifyPhoneClient() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const { t, lang } = useLanguage()

  const [step, setStep] = useState<Step>('add')
  const [phoneInput, setPhoneInput] = useState('')
  const [countryCode, setCountryCode] = useState<SupportedCountryCode>('+972')
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [phoneId, setPhoneId] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<VerificationStrategy>('meta_whatsapp')
  const [smsCountdown, setSmsCountdown] = useState(0)

  // Normalize returnTo: If driver, redirect to profile to avoid React Error #310 from orders page hydration.
  // Preserve query params (e.g. ?ref=inviterCode for driver invites).
  const rawReturnTo = searchParams.get('returnTo') || '/'
  const [pathPart, queryPart] = rawReturnTo.split('?')
  const path = pathPart || '/'
  const query = queryPart ? '?' + queryPart : ''
  const normalizedReturnTo =
    path === '/driver' || path.startsWith('/driver/') ? '/driver/profile' + query : rawReturnTo

  const intentChange = searchParams.get('intent') === 'change'

  const [prefilled, setPrefilled] = useState(false)

  // Pre-fill from query params (e.g. redirect from driver profile or tenant onboarding) or from Clerk user profile
  useEffect(() => {
    if (prefilled) return

    let digits = ''
    const codeParam = searchParams.get('countryCode')?.trim()
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

  // 30-second countdown before revealing SMS fallback on code step
  useEffect(() => {
    if (step !== 'code' || smsCountdown <= 0) return
    const timer = setInterval(() => setSmsCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [step, smsCountdown])

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

  const handleSendCode = async (startingStrategy: VerificationStrategy = 'meta_whatsapp') => {
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

      // Find if phone already exists in Clerk
      let phoneObj = user.phoneNumbers.find(p => p.phoneNumber === phoneNumber)
      
      if (phoneObj && phoneObj.verification?.status === 'verified') {
        if (intentChange) {
          setError(lang === 'ar' ? 'هذا الرقم مؤكد مسبقاً. يرجى إدخال رقم جديد لتغييره.' : 'This number is already verified. Please enter a new number to change it.')
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
          // Use short timeout so a hanging SDK import doesn't freeze the page.
          let dispatchId: string | undefined
          const sdkKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_PRELUDE_SDK_KEY : undefined
          if (sdkKey) {
            try {
              const timeoutMs = 3000
              dispatchId = await Promise.race([
                (async () => {
                  const { dispatchSignals } = await import('@prelude.so/js-sdk/signals')
                  return dispatchSignals(sdkKey)
                })(),
                new Promise<undefined>((_, reject) =>
                  setTimeout(() => reject(new Error('Prelude SDK timeout')), timeoutMs)
                ),
              ])
            } catch (err) {
              console.warn('Prelude SDK dispatch failed:', err)
            }
          }

          const res = await fetch('/api/verify-phone/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, dispatchId, channel: currentStrategy }),
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
    if (startingStrategy === 'meta_whatsapp') {
      success = await tryStrategy('meta_whatsapp')
      if (!success) {
        success = await tryStrategy('prelude_whatsapp')
      }
      if (!success) {
        success = await tryStrategy('prelude_sms')
      }
      if (!success) {
        success = await tryStrategy('clerk')
      }
    } else if (startingStrategy === 'prelude_whatsapp') {
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

    if (success) {
      const wasOnCode = step === 'code'
      setStep('code')
      if (!wasOnCode) setSmsCountdown(30)
    } else {
      setError(lang === 'ar' ? 'فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى لاحقاً.' : 'Failed to send verification code. Please try again later.')
    }
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
          body: JSON.stringify({ phoneNumber, code, intentChange, strategy }),
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
    <div
      className="relative min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, var(--m3-surface-container) 0%, oklch(0.97 0.01 85) 50%, oklch(0.985 0.008 60) 100%)',
      }}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Language switcher - top right, always visible */}
      <div className="absolute top-4 end-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* M3 card: 16dp rounded corners, elevation-2, 8dp grid spacing */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-md rounded-[16px] p-6 md:p-8"
        style={{
          background: 'var(--m3-surface-container-high)',
          boxShadow: 'var(--m3-elevation-2)',
          border: '1px solid var(--m3-outline-variant)',
        }}
      >
        {/* Brand logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.webp"
            alt={t('Bedi Delivery', 'بيدي للتوصيل')}
            width={80}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <div
            className="flex items-center justify-center size-10 rounded-full"
            style={{ background: 'rgba(239, 159, 32, 0.15)' }}
          >
            <Phone className="size-5" style={{ color: 'var(--color-brand-yellow)' }} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--color-brand-black)' }}>
            {intentChange
              ? t('Change your phone number', 'تغيير رقم الهاتف')
              : t('Verify your phone number', 'تأكيد رقم الهاتف')}
          </h1>
        </div>

        <p className="text-sm mb-4 text-center" style={{ color: 'var(--m3-on-surface-variant)' }}>
          {intentChange
            ? t("Enter your new number and we'll send a verification code. After verification it will be saved as your primary number.", 'أدخل رقمك الجديد وسنرسل لك رمز التحقق. بعد التأكيد سيتم حفظه كرقمك الأساسي.')
            : t('Orders are only accepted from verified numbers. Add your number and enter the code we send you.', 'الطلبات تُقبل فقط من أرقام موثّقة. أضف رقمك وأدخل الرمز الذي نرسله إليك.')}
        </p>

        {/* WhatsApp callout - prominent and clear */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
          style={{
            background: 'rgba(37, 211, 102, 0.12)',
            border: '1px solid rgba(37, 211, 102, 0.3)',
          }}
        >
          <FaWhatsapp className="size-8 shrink-0" style={{ color: '#25D366' }} />
          <div className="text-start min-w-0">
            <p className="font-semibold text-sm" style={{ color: 'var(--color-brand-black)' }}>
              {t('Code sent via WhatsApp', 'الرمز يُرسل عبر واتساب')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {t('Make sure your number uses WhatsApp.', 'تأكّد أن رقمك يستخدم واتساب.')}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="flex flex-col gap-4"
            >
              {/* Country code - visually prominent */}
              <div className="flex flex-col gap-2">
                <label
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: 'var(--color-brand-black)' }}
                >
                  <Globe className="size-4" style={{ color: 'var(--color-brand-yellow)' }} />
                  {t('Select your country code', 'اختر رمز دولتك')}
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value as SupportedCountryCode)}
                    dir="ltr"
                    className="h-12 rounded-xl border-2 px-4 text-sm font-medium min-w-[10rem] text-left"
                    style={{
                      borderColor: 'var(--color-brand-yellow)',
                      background: 'var(--m3-surface-container)',
                      color: 'var(--color-brand-black)',
                    }}
                    aria-label={t('Country code', 'مفتاح الدولة')}
                  >
                    <option value="+972">{t('Jerusalem (+972)', 'القدس (+972)')}</option>
                    <option value="+970">{t('Palestine (+970)', 'فلسطين (+970)')}</option>
                  </select>
                  <Input
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    placeholder={lang === 'ar' ? 'مثال: 0501234567' : 'e.g. 0501234567'}
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="flex-1 h-12 rounded-xl border-2 px-4 text-left"
                    style={{
                      background: 'var(--m3-surface-container)',
                      borderColor: 'var(--m3-outline-variant)',
                    }}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-start" style={{ color: 'var(--color-brand-red)' }}>{error}</p>
              )}
              <Button
                onClick={() => handleSendCode('meta_whatsapp')}
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold transition-all duration-200 bg-brand-yellow text-brand-black hover:bg-amber-500 hover:text-brand-black gap-2"
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
                }}
              >
                <FaWhatsapp className="size-5 shrink-0" style={{ color: 'var(--color-brand-black)' }} />
                {loading ? t('Sending…', 'جاري الإرسال…') : t('Send verification code', 'إرسال رمز التحقق')}
              </Button>
            </motion.div>
          )}

          {step === 'code' && (
            <motion.div
              key="code"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="flex flex-col gap-4"
            >
              <div>
                <p className="text-sm mb-1 text-start" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  {t('Enter the verification code we sent to', 'أدخل رمز التحقق الذي أرسلناه إلى')}{' '}
                  <span className="font-mono font-medium inline-block" dir="ltr" style={{ color: 'var(--color-brand-black)', textAlign: 'left' }}>
                    {ensureE164(phoneInput, countryCode)}
                  </span>
                </p>
                <p className="text-xs text-start" style={{ color: 'var(--m3-on-surface-variant)', opacity: 0.9 }}>
                  {strategy === 'meta_whatsapp'
                    ? t('Sent via WhatsApp', 'تم الإرسال عبر واتساب')
                    : strategy === 'prelude_whatsapp'
                      ? t('Sent via WhatsApp (Alternate)', 'تم الإرسال عبر واتساب (بديل)')
                      : strategy === 'prelude_sms'
                        ? t('Sent via SMS', 'تم الإرسال عبر رسالة نصية قصيرة')
                        : t('Sent via SMS (Alternate)', 'تم الإرسال عبر رسالة نصية (بديل)')}
                </p>
              </div>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                placeholder={t('Enter verification code', 'أدخل رمز التحقق')}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="h-12 rounded-xl border-0 px-4 text-center text-lg tracking-widest"
                style={{
                  background: 'var(--m3-surface-container)',
                  border: '1px solid var(--m3-outline-variant)',
                }}
              />
              {error && (
                <p className="text-sm text-start" style={{ color: 'var(--color-brand-red)' }}>{error}</p>
              )}
              <Button
                onClick={handleVerifyCode}
                disabled={loading || codeInput.length < 4}
                className="w-full h-12 rounded-xl font-semibold transition-all duration-200 bg-brand-yellow text-brand-black hover:bg-amber-500 hover:text-brand-black"
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
                }}
              >
                {loading ? t('Verifying…', 'جاري التحقق…') : t('Verify', 'تحقق')}
              </Button>

              <div className="flex flex-col gap-2 pt-2">
                {/* SMS fallback: countdown for 30s, then reveal */}
                {(strategy === 'meta_whatsapp' || strategy === 'prelude_whatsapp' || strategy === 'prelude_sms') && (
                  <>
                    {smsCountdown > 0 ? (
                      <div
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-start"
                        style={{
                          background: 'var(--m3-surface-container)',
                          border: '1px solid var(--m3-outline-variant)',
                        }}
                      >
                        <div
                          className="flex size-10 shrink-0 items-center justify-center rounded-full"
                          style={{ background: 'rgba(148, 163, 184, 0.2)' }}
                        >
                          <Clock className="size-5" style={{ color: 'var(--m3-on-surface-variant)' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'var(--color-brand-black)' }}>
                            {t("If you didn't receive the code on WhatsApp, you can also request it via SMS.", 'إذا لم تصلك الرسالة على واتساب، يمكنك طلب الرمز عبر رسالة SMS.')}
                          </p>
                          <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--color-brand-yellow)' }}>
                            {t('Available in', 'متوفر خلال')} {smsCountdown} {smsCountdown === 1 ? t('second', 'ثانية') : t('seconds', 'ثانية')}
                          </p>
                        </div>
                        <div
                          className="flex size-12 shrink-0 items-center justify-center rounded-full font-bold tabular-nums"
                          style={{
                            background: 'var(--color-brand-yellow)',
                            color: 'var(--color-brand-black)',
                            fontSize: '1.25rem',
                          }}
                        >
                          {smsCountdown}
                        </div>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                        className="flex flex-col gap-3 rounded-xl px-4 py-3 text-start"
                        style={{
                          background: 'var(--m3-surface-container)',
                          border: '1px solid var(--m3-outline-variant)',
                        }}
                      >
                        {strategy === 'prelude_sms' ? (
                          <p className="text-sm font-medium" style={{ color: 'var(--color-brand-black)' }}>
                            {t("Didn't receive the SMS? You can try an alternate provider.", 'لم تصلك الرسالة النصية؟ يمكنك تجربة مزود بديل.')}
                          </p>
                        ) : (
                          <p className="text-sm font-medium" style={{ color: 'var(--color-brand-black)' }}>
                            {t("If you did not receive the code on WhatsApp, you can also send it as SMS.", 'إذا لم تصلك الرسالة على واتساب، يمكنك إرسال الرمز عبر رسالة SMS بدلاً من ذلك.')}
                          </p>
                        )}
                        <div className="flex flex-col gap-2">
                          {strategy === 'meta_whatsapp' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendCode('prelude_whatsapp')}
                              disabled={loading}
                              className="rounded-xl border justify-start gap-2"
                              style={{ borderColor: 'var(--m3-outline-variant)' }}
                            >
                              <FaWhatsapp className="size-4 shrink-0" style={{ color: '#25D366' }} />
                              {t("Try alternate WhatsApp provider first", 'جرب مزود واتساب بديل أولاً')}
                            </Button>
                          )}
                          {(strategy === 'meta_whatsapp' || strategy === 'prelude_whatsapp') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendCode('prelude_sms')}
                              disabled={loading}
                              className="rounded-xl border justify-start gap-2 bg-slate-50"
                              style={{ borderColor: 'var(--m3-outline-variant)' }}
                            >
                              <MessageSquare className="size-4 shrink-0" />
                              {t('Send code via SMS', 'إرسال الرمز عبر SMS')}
                            </Button>
                          )}
                          {strategy === 'prelude_sms' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendCode('clerk')}
                              disabled={loading}
                              className="rounded-xl border justify-start gap-2"
                              style={{ borderColor: 'var(--m3-outline-variant)' }}
                            >
                              {t("Try alternate provider", 'جرب مزود بديل')}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full rounded-xl"
                  onClick={() => {
                    setStep('add')
                    setCodeInput('')
                    setError('')
                  }}
                >
                  {t('Use a different number', 'استخدام رقم آخر')}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <div
                className="flex items-center justify-center size-16 rounded-full"
                style={{ background: 'rgba(34, 197, 94, 0.15)' }}
              >
                <CheckCircle2 className="size-10" style={{ color: '#22c55e' }} />
              </div>
              <p className="font-semibold text-lg" style={{ color: '#22c55e' }}>
                {t('Phone verified!', 'تم تأكيد الهاتف!')}
              </p>
              <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {t('Redirecting…', 'جاري التوجيه…')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 pt-4 flex flex-col gap-2 text-start" style={{ borderTop: '1px solid var(--m3-outline-variant)' }}>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm transition-colors duration-200 w-fit"
            style={{ color: 'var(--m3-on-surface-variant)' }}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t('Back to homepage', 'العودة للصفحة الرئيسية')}
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 text-sm transition-colors duration-200 w-fit"
            style={{ color: 'var(--m3-on-surface-variant)', opacity: 0.8 }}
          >
            <RefreshCw className="size-4" />
            {t('Reload page', 'إعادة تحميل الصفحة')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
