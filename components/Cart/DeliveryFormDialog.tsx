'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { toEnglishDigits } from '@/lib/phone'
import { Truck, MapPin, Phone } from 'lucide-react'
import { client } from '@/sanity/lib/client'

interface Area {
  _id: string
  name_en: string
  name_ar: string
  deliveryPrice: number
  currency: string
  estimatedTime?: number
  isActive: boolean
}

interface DeliveryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName?: string
  initialPhone?: string
  initialAreaId?: string
  initialAddress?: string
  onSubmit: (name: string, phone: string, areaId: string, address: string, deliveryFee: number) => void
}

export function DeliveryFormDialog({
  open,
  onOpenChange,
  initialName = '',
  initialPhone = '',
  initialAreaId = '',
  initialAddress = '',
  onSubmit
}: DeliveryFormDialogProps) {
  const { t, lang } = useLanguage()
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAreaId, setFormAreaId] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch delivery areas from Sanity
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const query = `*[_type == "area" && isActive == true] | order(sortOrder asc, name_en asc) {
          _id,
          name_en,
          name_ar,
          deliveryPrice,
          currency,
          estimatedTime,
          isActive
        }`
        const result = await client.fetch(query)
        setAreas(result)
      } catch (error) {
        console.error('Failed to fetch delivery areas:', error)
      } finally {
        setLoading(false)
      }
    }

    if (open) {
      fetchAreas()
    }
  }, [open])

  // Initialize form values when dialog opens
  useEffect(() => {
    if (open) {
      setFormName(initialName)
      setFormPhone(initialPhone)
      setFormAreaId(initialAreaId)
      setFormAddress(initialAddress)
    }
  }, [open, initialName, initialPhone, initialAreaId, initialAddress])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const selectedArea = areas.find(a => a._id === formAreaId)
    const deliveryFee = selectedArea?.deliveryPrice || 0

    if (formName.trim() && formPhone.trim() && formAreaId && formAddress.trim()) {
      onSubmit(formName.trim(), formPhone.trim(), formAreaId, formAddress.trim(), deliveryFee)
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    setFormName(initialName)
    setFormPhone(initialPhone)
    setFormAreaId(initialAreaId)
    setFormAddress(initialAddress)
    onOpenChange(false)
  }

  const selectedArea = areas.find(a => a._id === formAreaId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95%] rounded-[32px] p-8 border-none shadow-2xl max-h-[90vh] overflow-y-auto pb-[max(2rem,calc(env(safe-area-inset-bottom)+100px))]">
        <DialogHeader className="mb-6">
          <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center mb-4">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-2xl font-black">
            {t('Delivery Details', 'تفاصيل التوصيل')}
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500">
            {t('Please provide your delivery information', 'يرجى تقديم معلومات التوصيل')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
              {t('Your Name', 'اسمك')} *
            </label>
            <Input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t('Enter your name', 'أدخل اسمك')}
              className="h-14 text-lg rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold px-5"
              required
              inputMode="text"
              autoComplete="name"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {t('Mobile Number', 'رقم الجوال')} *
            </label>
            <Input
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(toEnglishDigits(e.target.value))}
              placeholder={t('e.g., 0501234567', 'مثال: 0501234567')}
              className="h-14 text-lg rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold px-5"
              required
              inputMode="tel"
              autoComplete="tel"
            />
          </div>

          {/* Delivery Area */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {t('Delivery Area', 'منطقة التوصيل')} *
            </label>
            {loading ? (
              <div className="h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                <div className="text-sm text-slate-400">{t('Loading areas...', 'جارٍ تحميل المناطق...')}</div>
              </div>
            ) : areas.length === 0 ? (
              <div className="h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                <div className="text-sm text-red-600 font-semibold">
                  {t('No delivery areas available', 'لا توجد مناطق توصيل متاحة')}
                </div>
              </div>
            ) : (
              <select
                value={formAreaId}
                onChange={(e) => setFormAreaId(e.target.value)}
                className="h-14 w-full text-lg rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold px-5 cursor-pointer"
                required
              >
                <option value="">
                  {t('Select your area', 'اختر منطقتك')}
                </option>
                {areas.map((area) => {
                  const areaName = lang === 'ar' ? area.name_ar : area.name_en
                  const priceText = area.deliveryPrice === 0
                    ? t('Free', 'مجاني')
                    : `${area.deliveryPrice} ${area.currency}`
                  const timeText = area.estimatedTime
                    ? ` • ${area.estimatedTime} ${t('min', 'دقيقة')}`
                    : ''
                  return (
                    <option key={area._id} value={area._id}>
                      {areaName} - {priceText}{timeText}
                    </option>
                  )
                })}
              </select>
            )}
            {selectedArea && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-sm font-bold text-green-800">
                  {t('Delivery Fee', 'رسوم التوصيل')}: {selectedArea.deliveryPrice === 0
                    ? t('Free', 'مجاني')
                    : `${selectedArea.deliveryPrice} ${selectedArea.currency}`
                  }
                  {selectedArea.estimatedTime && (
                    <span className="ml-2 rtl:mr-2 rtl:ml-0">
                      • {t('Est.', 'تقريباً')} {selectedArea.estimatedTime} {t('min', 'دقيقة')}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Specific Address */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
              {t('Detailed Address', 'العنوان التفصيلي')} *
            </label>
            <textarea
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder={t('Street, building number, floor, apartment...', 'الشارع، رقم المبنى، الطابق، الشقة...')}
              className="w-full min-h-[100px] text-base rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white transition-all font-semibold px-5 py-4 resize-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="flex-1 h-14 rounded-2xl font-black text-slate-400"
            >
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              type="submit"
              className="flex-1 h-14 rounded-2xl font-black bg-green-600 text-white shadow-xl shadow-green-600/10 hover:bg-green-700 active:scale-[0.98] transition-all"
              disabled={!formName.trim() || !formPhone.trim() || !formAreaId || !formAddress.trim()}
            >
              {t('Continue', 'متابعة')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
