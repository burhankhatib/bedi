'use client'

import { useState } from 'react'
import { UtensilsCrossed, UserRoundPlus, CreditCard, Banknote, Loader2 } from 'lucide-react'
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

interface TableChoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  tableNumber: string
  /** Called when user chooses "View online menu" — close modal and show menu */
  onViewMenu: () => void
}

export function TableChoiceModal({
  open,
  onOpenChange,
  tenantSlug,
  tableNumber,
  onViewMenu,
}: TableChoiceModalProps) {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const [payMode, setPayMode] = useState<'idle' | 'choosing' | 'sending'>('idle')
  const [sendingPayment, setSendingPayment] = useState(false)
  const [requestingWaiter, setRequestingWaiter] = useState(false)
  const isRtl = lang === 'ar'

  const handleCallWaiter = async () => {
    setRequestingWaiter(true)
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/table-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        showToast(
          t('Waiter has been notified. Someone will be with you shortly.', 'تم إخطار النادل. سيأتي شخص قريباً.'),
          undefined,
          'success'
        )
      } else {
        showToast(data?.error || t('Request failed. Try again.', 'فشل الطلب. حاول مرة أخرى.'), undefined, 'error')
      }
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

  const handleViewMenu = () => {
    onViewMenu()
    onOpenChange(false)
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
            {t('Table', 'طاولة')} {tableNumber}
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            {t('What would you like to do?', 'ماذا تريد أن تفعل؟')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            size="lg"
            onClick={handleViewMenu}
            className="h-14 w-full rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 hover:text-white"
            style={{ touchAction: 'manipulation' }}
          >
            <UtensilsCrossed className="mr-3 size-6 shrink-0" aria-hidden />
            {t('View online menu', 'عرض القائمة الإلكترونية')}
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={handleCallWaiter}
            disabled={requestingWaiter}
            className="h-14 w-full rounded-2xl border-2 border-amber-500 bg-amber-50 text-base font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-400 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/50"
            style={{ touchAction: 'manipulation' }}
          >
            {requestingWaiter ? (
              <Loader2 className="mr-3 size-6 shrink-0 animate-spin" aria-hidden />
            ) : (
              <UserRoundPlus className="mr-3 size-6 shrink-0" aria-hidden />
            )}
            {requestingWaiter
              ? t('Sending…', 'جاري الإرسال…')
              : t('Call waiter', 'طلب النادل')}
          </Button>

          {payMode === 'idle' ? (
            <Button
              size="lg"
              variant="outline"
              onClick={() => setPayMode('choosing')}
              className="h-14 w-full rounded-2xl border-2 border-slate-300 bg-white text-base font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handleRequestPay('cash')}
                  disabled={sendingPayment}
                  className="h-12 rounded-xl border-2 font-semibold"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Banknote className="mr-2 size-5" />
                  {t('Cash', 'نقداً')}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handleRequestPay('card')}
                  disabled={sendingPayment}
                  className="h-12 rounded-xl border-2 font-semibold"
                  style={{ touchAction: 'manipulation' }}
                >
                  <CreditCard className="mr-2 size-5" />
                  {t('Card', 'بطاقة')}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPayMode('idle')}
                className="text-slate-600 dark:text-slate-400"
              >
                {t('Back', 'رجوع')}
              </Button>
            </div>
          ) : (
            <div className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Loader2 className="size-6 animate-spin text-slate-600 dark:text-slate-400" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
