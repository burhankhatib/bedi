'use client'

import { useCart } from './CartContext'
import { useLanguage } from '@/components/LanguageContext'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CartToast() {
  const { toast, hideToast, setIsOpen, totalItems } = useCart()
  const { t } = useLanguage()

  if (!toast) return null

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 min-w-[280px] max-w-[90vw] pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-900">
                  {t('Added to cart', 'تمت الإضافة إلى السلة')}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {toast.productName}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={hideToast}
                className="h-8 w-8 rounded-full shrink-0 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </Button>
        </div>
        {totalItems > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <Button
              onClick={() => {
                hideToast()
                setIsOpen(true)
              }}
              className="w-full h-9 rounded-xl font-bold bg-black hover:bg-slate-800 text-sm"
            >
              {t('View Cart', 'عرض السلة')} ({totalItems})
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
