'use client'

import { useState, useEffect, useRef } from 'react'
import {
  UtensilsCrossed,
  Users,
  UserRoundPlus,
  CreditCard,
  Banknote,
  Loader2,
  Wifi,
  ChevronLeft,
  Crown,
} from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TableChoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  tableNumber: string
  /** Called when user confirms joining the group order (with their display name). */
  onJoinGroup: (displayName: string) => void
  /** Called when user declines to join the group order. */
  onDecline: () => void
  /** Pre-fill display name for logged-in users. */
  initialDisplayName?: string
  wifiNetwork?: string
  wifiPassword?: string
}

type ModalStep = 'decide' | 'name'

interface SessionMember {
  deviceId: string
  displayName: string
  role: 'leader' | 'member'
}

export function TableChoiceModal({
  open,
  onOpenChange,
  tenantSlug,
  tableNumber,
  onJoinGroup,
  onDecline,
  initialDisplayName = '',
  wifiNetwork,
  wifiPassword,
}: TableChoiceModalProps) {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const isRtl = lang === 'ar'

  const [step, setStep] = useState<ModalStep>('decide')
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [payMode, setPayMode] = useState<'idle' | 'choosing' | 'sending'>('idle')
  const [sendingPayment, setSendingPayment] = useState(false)
  const [requestingWaiter, setRequestingWaiter] = useState(false)
  const [sessionMembers, setSessionMembers] = useState<SessionMember[]>([])
  const [loadingSession, setLoadingSession] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset state on open and fetch existing session
  useEffect(() => {
    if (open && tenantSlug && tableNumber) {
      setStep('decide')
      setPayMode('idle')
      setDisplayName(initialDisplayName)
      setLoadingSession(true)
      fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/table/${encodeURIComponent(tableNumber)}/cart`)
        .then(res => res.json())
        .then(data => {
          setSessionMembers(data?.session?.members ?? [])
        })
        .catch(() => setSessionMembers([]))
        .finally(() => setLoadingSession(false))
    }
  }, [open, tenantSlug, tableNumber, initialDisplayName])

  // Focus name input when entering name step
  useEffect(() => {
    if (step === 'name') {
      setTimeout(() => nameInputRef.current?.focus(), 150)
    }
  }, [step])

  const hasActiveSession = sessionMembers.length > 0

  const handleJoinConfirm = () => {
    const name = displayName.trim()
    if (!name) {
      showToast(t('Please enter your name.', 'يرجى إدخال اسمك.'), undefined, 'error')
      return
    }
    onJoinGroup(name)
    onOpenChange(false)
  }

  const handleCallWaiter = async () => {
    setRequestingWaiter(true)
    try {
      const orderRes = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/orders/by-table?table=${encodeURIComponent(tableNumber)}`
      )
      const orderData = await orderRes.json().catch(() => ({}))
      const trackingToken = orderData?.trackingToken

      let ok = false
      if (trackingToken) {
        const requestRes = await fetch(
          `/api/tenants/${encodeURIComponent(tenantSlug)}/track/${encodeURIComponent(trackingToken)}/request`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'call_waiter' }),
          }
        )
        const requestData = await requestRes.json().catch(() => ({}))
        ok = requestRes.ok && requestData.success
        if (!ok) {
          showToast(requestData?.error || t('Request failed. Try again.', 'فشل الطلب. حاول مرة أخرى.'), undefined, 'error')
          return
        }
      } else {
        const res = await fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/table-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableNumber }),
        })
        const data = await res.json().catch(() => ({}))
        ok = res.ok && data.success
        if (!ok) {
          showToast(data?.error || t('Request failed. Try again.', 'فشل الطلب. حاول مرة أخرى.'), undefined, 'error')
          return
        }
      }

      showToast(
        t('Waiter has been notified. Someone will be with you shortly.', 'تم إخطار النادل. سيأتي شخص قريباً.'),
        undefined,
        'success'
      )
      onOpenChange(false)
    } catch {
      showToast(t('Request failed. Try again.', 'فشل الطلب. حاول مرة أخرى.'), undefined, 'error')
    } finally {
      setRequestingWaiter(false)
    }
  }

  const handleRequestPay = async (paymentMethod: 'cash' | 'card') => {
    setPayMode('sending')
    setSendingPayment(true)
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/orders/by-table?table=${encodeURIComponent(tableNumber)}`
      )
      const data = await res.json().catch(() => ({}))
      const token = data?.trackingToken
      if (!token) {
        showToast(
          t('No active order for this table. Place an order first, then request the check.', 'لا يوجد طلب نشط لهذه الطاولة. قدم طلباً أولاً ثم اطلب الفاتورة.'),
          undefined,
          'info'
        )
        setPayMode('idle')
        setSendingPayment(false)
        return
      }
      const requestRes = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/track/${encodeURIComponent(token)}/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'request_check', paymentMethod }),
        }
      )
      const requestData = await requestRes.json().catch(() => ({}))
      if (requestRes.ok && requestData.success) {
        showToast(
          paymentMethod === 'cash'
            ? t('Check requested (cash). Waiter will bring the bill.', 'تم طلب الفاتورة (نقداً). سيحضر النادل الفاتورة.')
            : t('Check requested (card). Waiter will bring the card machine.', 'تم طلب الفاتورة (بطاقة). سيحضر النادل جهاز الدفع.'),
          undefined,
          'success'
        )
        setPayMode('idle')
        setSendingPayment(false)
        onOpenChange(false)
      } else {
        showToast(requestData?.error || t('Request failed. Try again.', 'فشل الطلب. حاول مرة أخرى.'), undefined, 'error')
        setPayMode('idle')
        setSendingPayment(false)
      }
    } catch {
      showToast(t('Request failed. Try again.', 'فشل الطلب. حاول مرة أخرى.'), undefined, 'error')
      setPayMode('idle')
      setSendingPayment(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={true}
        className="max-w-md rounded-3xl border-0 bg-slate-50 shadow-2xl dark:bg-slate-900"
        overlayClassName="z-[300]"
        contentClassName="z-[301]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="text-center pb-2">
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            {step === 'name'
              ? t('What\'s your name?', 'ما اسمك؟')
              : `${t('Table', 'طاولة')} ${tableNumber}`}
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            {step === 'name'
              ? t('Enter your name so others at the table can see your order.', 'أدخل اسمك حتى يتمكن الآخرون من رؤية طلبك.')
              : hasActiveSession
                ? t('There\'s an active group order at this table. Join to add your items!', 'يوجد طلب مجموعة نشط في هذه الطاولة. انضم لإضافة طلباتك!')
                : t('Scan detected. Join the group order or browse on your own.', 'تم الكشف عن رمز QR. انضم للطلب الجماعي أو تصفح بمفردك.')}
          </DialogDescription>
        </DialogHeader>

        {/* ── STEP 1: DECIDE ── */}
        {step === 'decide' && (
          <div className="flex flex-col gap-3 pt-2">
            {/* Active session member list */}
            {loadingSession && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="size-5 animate-spin text-slate-400" />
              </div>
            )}
            {!loadingSession && hasActiveSession && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  {t('Currently at the table', 'حالياً عند الطاولة')} ({sessionMembers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {sessionMembers.map((m) => (
                    <span
                      key={m.deviceId}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-300"
                    >
                      {m.role === 'leader' && <Crown className="size-3 text-amber-500" />}
                      {m.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Primary action: Join group ordering */}
            <Button
              size="lg"
              onClick={() => setStep('name')}
              className="h-14 w-full rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700"
              style={{ touchAction: 'manipulation' }}
            >
              <Users className="mr-3 size-6 shrink-0" aria-hidden />
              {hasActiveSession
                ? t('Join group order', 'الانضمام للطلب الجماعي')
                : t('Start group ordering', 'بدء الطلب الجماعي')}
            </Button>

            {/* Secondary action: Solo browse */}
            <Button
              size="lg"
              variant="outline"
              onClick={onDecline}
              className="h-14 w-full rounded-2xl border-2 border-slate-300 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              style={{ touchAction: 'manipulation' }}
            >
              <UtensilsCrossed className="mr-3 size-6 shrink-0" aria-hidden />
              {t('Browse on my own', 'تصفح بمفردي')}
            </Button>

            <div className="my-1 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs font-medium text-slate-400">{t('OR', 'أو')}</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Call waiter */}
            <Button
              size="lg"
              variant="outline"
              onClick={handleCallWaiter}
              disabled={requestingWaiter}
              className="h-14 w-full rounded-2xl border-2 border-amber-500 bg-amber-50 text-base font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-400 dark:bg-amber-950/50 dark:text-amber-200"
              style={{ touchAction: 'manipulation' }}
            >
              {requestingWaiter ? (
                <Loader2 className="mr-3 size-6 shrink-0 animate-spin" aria-hidden />
              ) : (
                <UserRoundPlus className="mr-3 size-6 shrink-0" aria-hidden />
              )}
              {requestingWaiter ? t('Sending…', 'جاري الإرسال…') : t('Call waiter', 'طلب النادل')}
            </Button>

            {/* Pay */}
            {payMode === 'idle' ? (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setPayMode('choosing')}
                className="h-14 w-full rounded-2xl border-2 border-slate-300 bg-white text-base font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                style={{ touchAction: 'manipulation' }}
              >
                <CreditCard className="mr-3 size-6 shrink-0" aria-hidden />
                {t('I want to pay', 'أريد الدفع')}
              </Button>
            ) : payMode === 'choosing' ? (
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-slate-200 bg-slate-100/80 p-3 dark:border-slate-600 dark:bg-slate-800/80">
                <p className="text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {t('How would you like to pay?', 'كيف تريد الدفع؟')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="lg" variant="outline" onClick={() => handleRequestPay('cash')} disabled={sendingPayment} className="h-12 rounded-xl border-2 font-semibold" style={{ touchAction: 'manipulation' }}>
                    <Banknote className="mr-2 size-5" />
                    {t('Cash', 'نقداً')}
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => handleRequestPay('card')} disabled={sendingPayment} className="h-12 rounded-xl border-2 font-semibold" style={{ touchAction: 'manipulation' }}>
                    <CreditCard className="mr-2 size-5" />
                    {t('Card', 'بطاقة')}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPayMode('idle')} className="text-slate-600 dark:text-slate-400">
                  {t('Back', 'رجوع')}
                </Button>
              </div>
            ) : (
              <div className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Loader2 className="size-6 animate-spin text-slate-600 dark:text-slate-400" />
              </div>
            )}

            {/* WiFi info */}
            {wifiNetwork && (
              <div className="mt-1 rounded-2xl border-2 border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Wifi className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{t('Free WiFi', 'واي فاي مجاني')}</p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{t('Network:', 'الشبكة:')}</span>{' '}
                      <span dir="ltr" className="inline-block text-slate-900 dark:text-white">{wifiNetwork}</span>
                    </p>
                    {wifiPassword && (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-medium">{t('Password:', 'كلمة المرور:')}</span>{' '}
                          <span dir="ltr" className="inline-block font-mono text-slate-900 dark:text-white">{wifiPassword}</span>
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-slate-700"
                          onClick={() => {
                            navigator.clipboard.writeText(wifiPassword)
                            showToast(t('Password copied!', 'تم نسخ كلمة المرور!'), undefined, 'success')
                          }}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: NAME ENTRY ── */}
        {step === 'name' && (
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Input
                ref={nameInputRef}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoinConfirm()}
                placeholder={t('Your name (e.g. Ahmed)', 'اسمك (مثال: أحمد)')}
                className="h-12 rounded-xl border-2 border-slate-200 bg-white text-base focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                maxLength={40}
                autoComplete="given-name"
              />
            </div>

            <Button
              size="lg"
              onClick={handleJoinConfirm}
              disabled={!displayName.trim()}
              className="h-14 w-full rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 disabled:opacity-50"
              style={{ touchAction: 'manipulation' }}
            >
              <Users className="mr-3 size-6 shrink-0" aria-hidden />
              {hasActiveSession
                ? t('Join group order', 'الانضمام للطلب الجماعي')
                : t('Start group ordering', 'بدء الطلب الجماعي')}
            </Button>

            <Button
              variant="ghost"
              onClick={() => setStep('decide')}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400"
            >
              <ChevronLeft className="size-4" />
              {t('Back', 'رجوع')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
