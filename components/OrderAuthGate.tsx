'use client'

/**
 * Gate for placing orders: requires sign-in + verified phone.
 * Renders a clear message that orders from unverified numbers are not accepted.
 *
 * Uses <a> (full-page nav) here: verification + auth links need a forced load for clean
 * session state. Prefer Link elsewhere for fast SPA navigation (critical for slow 3G).
 */
import { usePathname } from 'next/navigation'
import { useOrderAuth } from '@/lib/useOrderAuth'
import { Button } from '@/components/ui/button'
import { ShieldAlert, Phone } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

const MESSAGE_SIGN_IN_EN = 'Sign in and verify your phone to place an order. Orders from unverified numbers are not accepted.'
const MESSAGE_SIGN_IN_AR = 'سجّل الدخول وثبّت رقم هاتفك لوضع الطلب. الطلبات من أرقام غير موثّقة لا تُقبل.'
const MESSAGE_VERIFY_EN = 'Verify your phone number to place an order. Orders from unverified numbers are not accepted.'
const MESSAGE_VERIFY_AR = 'ثبّت رقم هاتفك لوضع الطلب. الطلبات من أرقام غير موثّقة لا تُقبل.'

interface OrderAuthGateProps {
  /** If provided, the verify-phone link will return to this path (e.g. tenant menu). */
  returnTo?: string
  /** Optional slug for tenant (e.g. for /t/[slug]/verify-phone). */
  tenantSlug?: string
  /** Inline (compact) vs block (card) style. */
  variant?: 'inline' | 'block'
  children: React.ReactNode
}

export function OrderAuthGate({ returnTo, tenantSlug, variant = 'block', children }: OrderAuthGateProps) {
  const { t, lang } = useLanguage()
  const pathname = usePathname()
  const { isLoaded, needsSignIn, needsPhoneVerification } = useOrderAuth()
  const signInRedirectUrl = returnTo || (tenantSlug ? `/t/${tenantSlug}` : pathname || '/')
  // Always send new sign-ups to verify-phone first (customers must verify to order).
  const signUpRedirectUrl = `/verify-phone?returnTo=${encodeURIComponent(signInRedirectUrl)}`

  if (!isLoaded) return <>{children}</>
  if (!needsSignIn && !needsPhoneVerification) return <>{children}</>

  const verifyUrl = tenantSlug
    ? `/t/${tenantSlug}/verify-phone${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`
    : `/verify-phone${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`

  const isInline = variant === 'inline'

  if (needsSignIn) {
    return (
      <div
        className={
          isInline
            ? 'rounded-xl border border-amber-200 bg-amber-50 p-4'
            : 'rounded-2xl border-2 border-amber-200 bg-amber-50/90 p-6 text-center'
        }
      >
        <div className="flex items-center justify-center gap-2 text-amber-800 mb-3">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span className="font-semibold">
            {t('Account required to order', 'حساب مطلوب للطلب')}
          </span>
        </div>
        <p className="text-sm text-amber-900 mb-4">
          {lang === 'ar' ? MESSAGE_SIGN_IN_AR : MESSAGE_SIGN_IN_EN}
        </p>
        <p className="text-xs text-amber-800/90 mb-3">
          {t('After signing in you’ll return here to complete your order. Your cart is saved.', 'بعد تسجيل الدخول ستُعاد إلى هذه الصفحة لإكمال الطلب. سلّتك محفوظة.')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white touch-manipulation">
            <a href={`/sign-in?redirect_url=${encodeURIComponent(signInRedirectUrl)}`}>
              {t('Sign in', 'تسجيل الدخول')}
            </a>
          </Button>
          <Button asChild variant="outline" className="border-amber-600 text-amber-800 hover:bg-amber-100 touch-manipulation">
            <a href={`/sign-up?redirect_url=${encodeURIComponent(signInRedirectUrl)}`}>
              {t('Sign up', 'إنشاء حساب')}
            </a>
          </Button>
        </div>
      </div>
    )
  }

  if (needsPhoneVerification) {
    return (
      <div
        className={
          isInline
            ? 'rounded-xl border border-amber-200 bg-amber-50 p-4'
            : 'rounded-2xl border-2 border-amber-200 bg-amber-50/90 p-6 text-center'
        }
      >
        <div className="flex items-center justify-center gap-2 text-amber-800 mb-3">
          <Phone className="h-5 w-5 shrink-0" />
          <span className="font-semibold">
            {t('Verify your phone to order', 'ثبّت هاتفك للطلب')}
          </span>
        </div>
        <p className="text-sm text-amber-900 mb-4">
          {lang === 'ar' ? MESSAGE_VERIFY_AR : MESSAGE_VERIFY_EN}
        </p>
        <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white touch-manipulation">
          <a href={verifyUrl}>{t('Verify phone number', 'تأكيد رقم الهاتف')}</a>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
