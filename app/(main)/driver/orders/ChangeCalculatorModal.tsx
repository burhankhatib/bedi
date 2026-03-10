'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { X } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

type ChangeCalculatorModalProps = {
  open: boolean
  onClose: () => void
  orderTotal: number
  currency: string
}

export function ChangeCalculatorModal({
  open,
  onClose,
  orderTotal,
  currency,
}: ChangeCalculatorModalProps) {
  const { t } = useLanguage()
  const [input, setInput] = useState('')

  useEffect(() => {
    if (open) setInput('')
  }, [open])

  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₪'
  const customerPaid = parseFloat(input) || 0
  const change = customerPaid - orderTotal
  const hasInput = input.length > 0 && customerPaid > 0

  const handleKey = useCallback((key: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10)
    }
    if (key === 'C') {
      setInput('')
    } else if (key === 'BS') {
      setInput((prev) => prev.slice(0, -1))
    } else {
      setInput((prev) => (prev.length >= 6 ? prev : prev + key))
    }
  }, [])

  const setQuickAmount = useCallback((amount: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10)
    }
    setInput(String(amount))
  }, [])

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BS']

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-[360px] p-0 bg-slate-900 border-slate-700 overflow-hidden rounded-3xl gap-0 z-[200]"
        overlayClassName="z-[200]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-lg font-black text-white">
            {t('Change Calculator', 'حاسبة الباقي')}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Total */}
        <div className="px-5 pb-2">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            {t('Order Total', 'إجمالي الطلب')}
          </p>
          <p className="text-3xl font-black text-white">
            {orderTotal.toFixed(2)} {symbol}
          </p>
        </div>

        {/* Customer Paid Input */}
        <div className="mx-5 rounded-2xl bg-slate-800/80 border border-slate-700 px-4 py-3 mb-2">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            {t('Customer Paid', 'المبلغ المدفوع')}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-white tabular-nums min-h-[48px]">
              {input || <span className="text-slate-600">0</span>}
            </p>
            <span className="text-xl font-bold text-slate-500">{symbol}</span>
          </div>
        </div>

        {/* Change Result */}
        {hasInput && (
          <div
            className={`mx-5 rounded-2xl px-4 py-3 mb-2 border ${
              change >= 0
                ? 'bg-emerald-950/50 border-emerald-500/40'
                : 'bg-red-950/50 border-red-500/40'
            }`}
          >
            <p
              className={`text-xs font-bold uppercase tracking-wider ${
                change >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
              }`}
            >
              {change >= 0
                ? t('Give Back', 'أعط الباقي')
                : t('Not Enough', 'المبلغ غير كافٍ')}
            </p>
            <p
              className={`text-4xl font-black tabular-nums ${
                change >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {Math.abs(change).toFixed(2)} {symbol}
            </p>
          </div>
        )}

        {/* Quick Amounts */}
        <div className="flex gap-2 px-5 mb-2">
          {[50, 100, 200].map((amount) => (
            <button
              key={amount}
              onClick={() => setQuickAmount(amount)}
              className="flex-1 py-3.5 rounded-xl bg-slate-800 border border-slate-600 text-white font-bold text-lg hover:bg-slate-700 active:scale-95 transition-all"
            >
              {amount}
            </button>
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-1.5 px-5 pb-5">
          {KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className={`h-[68px] rounded-2xl text-2xl font-bold flex items-center justify-center transition-all active:scale-95 select-none ${
                key === 'C'
                  ? 'bg-amber-500/20 text-amber-400 active:bg-amber-500/30'
                  : key === 'BS'
                    ? 'bg-red-500/15 text-red-400 active:bg-red-500/25'
                    : 'bg-slate-800 text-white active:bg-slate-700'
              }`}
            >
              {key === 'BS' ? '⌫' : key}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
