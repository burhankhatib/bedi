'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import { UtensilsCrossed, Truck } from 'lucide-react'
import { OrderType } from './CartContext'

interface OrderTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectType: (type: OrderType) => void
}

export function OrderTypeDialog({
  open,
  onOpenChange,
  onSelectType
}: OrderTypeDialogProps) {
  const { t } = useLanguage()

  const handleTypeSelection = (type: OrderType) => {
    onSelectType(type)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95%] rounded-[32px] p-8 border-none shadow-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl font-black text-center">
            {t('Order Type', 'نوع الطلب')}
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500 text-center">
            {t('How would you like to receive your order?', 'كيف تريد استلام طلبك؟')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Dine-in Option */}
          <Button
            onClick={() => handleTypeSelection('dine-in')}
            className="w-full h-auto py-6 px-6 rounded-2xl font-bold text-lg bg-slate-900 hover:bg-slate-800 flex items-center justify-start gap-4 text-left"
          >
            <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="font-black text-xl mb-1">
                {t('Dine-in', 'تناول الطعام هنا')}
              </div>
              <div className="text-sm text-slate-300 font-normal">
                {t('Order at your table', 'اطلب على طاولتك')}
              </div>
            </div>
          </Button>

          {/* Delivery Option */}
          <Button
            onClick={() => handleTypeSelection('delivery')}
            className="w-full h-auto py-6 px-6 rounded-2xl font-bold text-lg bg-green-600 hover:bg-green-700 flex items-center justify-start gap-4 text-left"
          >
            <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <Truck className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="font-black text-xl mb-1">
                {t('Delivery', 'توصيل')}
              </div>
              <div className="text-sm text-green-100 font-normal">
                {t('Get it delivered to your location', 'احصل عليه في موقعك')}
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
