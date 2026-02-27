'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Check, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'

type Area = { _id: string; name_en: string; name_ar: string; deliveryPrice: number; currency: string; isActive: boolean; sortOrder?: number }
type AreaSuggestion = { name_en: string; name_ar: string }

export function AreasManageClient({
  slug,
  initialAreas,
  initialCountry,
  initialCity,
}: {
  slug: string
  initialAreas: Area[]
  initialCountry: string
  initialCity: string
}) {
  const [areas, setAreas] = useState<Area[]>(initialAreas)
  const [suggestedAreas, setSuggestedAreas] = useState<AreaSuggestion[]>([])
  const [addingCustom, setAddingCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editPriceValue, setEditPriceValue] = useState('')
  const { showToast } = useToast()
  const { t } = useLanguage()

  const api = (path: string, options?: RequestInit) =>
    fetch(`/api/tenants/${slug}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })

  const areasFetchedRef = useRef<string | null>(null)
  const areasKey = `${initialCountry}|${initialCity}|${slug}`
  // Load suggested areas for tenant's city: areas used by other businesses in same city (plus predefined), excluding this tenant's areas (single fetch per params)
  useEffect(() => {
    if (!initialCountry || !initialCity) {
      setSuggestedAreas([])
      return
    }
    if (areasFetchedRef.current === areasKey) return
    areasFetchedRef.current = areasKey
    const params = new URLSearchParams({ country: initialCountry, city: initialCity, slug })
    fetch(`/api/areas?${params}`)
      .then((r) => r.json())
      .then((list) => setSuggestedAreas(Array.isArray(list) ? list : []))
      .catch(() => setSuggestedAreas([]))
  }, [initialCountry, initialCity, slug])

  const isAlreadyAdded = (nameEn: string, nameAr: string) =>
    areas.some((a) => a.name_en.trim().toLowerCase() === nameEn.trim().toLowerCase() && a.name_ar.trim() === nameAr.trim())

  const handleQuickAdd = async (suggestion: AreaSuggestion) => {
    if (isAlreadyAdded(suggestion.name_en, suggestion.name_ar)) return
    setLoading(true)
    try {
      const res = await api('/areas', {
        method: 'POST',
        body: JSON.stringify({
          name_en: suggestion.name_en.trim(),
          name_ar: suggestion.name_ar.trim(),
          deliveryPrice: 0,
        }),
      })
      const data = await res.json()
      if (res.ok && data._id) {
        const newArea: Area = {
          _id: data._id,
          name_en: data.name_en ?? suggestion.name_en.trim(),
          name_ar: data.name_ar ?? suggestion.name_ar.trim(),
          deliveryPrice: data.deliveryPrice ?? 0,
          currency: data.currency ?? 'ILS',
          isActive: data.isActive !== false,
          sortOrder: data.sortOrder,
        }
        setAreas((prev) => [...prev, newArea])
        showToast(t('Area added. Set delivery fee above if needed.', 'تمت إضافة المنطقة. يمكنك تعيين رسوم التوصيل أعلاه إذا لزم الأمر.'), undefined, 'success')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddCustom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const name_en = (form.querySelector('[name="name_en"]') as HTMLInputElement).value.trim()
    const name_ar = (form.querySelector('[name="name_ar"]') as HTMLInputElement).value.trim()
    const priceInput = form.querySelector('[name="deliveryPrice"]') as HTMLInputElement
    const deliveryPrice = priceInput.value === '' ? 0 : parseFloat(priceInput.value)
    if (!name_en || !name_ar) return
    if (deliveryPrice !== 0 && isNaN(deliveryPrice)) return
    setLoading(true)
    try {
      const res = await api('/areas', {
        method: 'POST',
        body: JSON.stringify({ name_en, name_ar, deliveryPrice: isNaN(deliveryPrice) ? 0 : deliveryPrice }),
      })
      const data = await res.json()
      if (res.ok && data._id) {
        const newArea: Area = {
          _id: data._id,
          name_en: data.name_en ?? name_en,
          name_ar: data.name_ar ?? name_ar,
          deliveryPrice: data.deliveryPrice ?? 0,
          currency: data.currency ?? 'ILS',
          isActive: data.isActive !== false,
          sortOrder: data.sortOrder,
        }
        setAreas((prev) => [...prev, newArea])
        setAddingCustom(false)
        form.reset()
        showToast(t('Area added.', 'تمت إضافة المنطقة.'), undefined, 'success')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('Remove this delivery area?', 'إزالة منطقة التوصيل هذه؟'))) return
    setLoading(true)
    try {
      const res = await api(`/areas/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAreas((prev) => prev.filter((a) => a._id !== id))
        showToast(t('Area removed.', 'تمت إزالة المنطقة.'), undefined, 'success')
      }
    } finally {
      setLoading(false)
    }
  }

  const startEditPrice = (a: Area) => {
    setEditingPriceId(a._id)
    setEditPriceValue(a.deliveryPrice === 0 ? '' : String(a.deliveryPrice))
  }
  const cancelEditPrice = () => {
    setEditingPriceId(null)
    setEditPriceValue('')
  }
  const saveEditPrice = async (id: string) => {
    const num = editPriceValue.trim() === '' ? 0 : parseFloat(editPriceValue)
    if (isNaN(num) || num < 0) return
    setLoading(true)
    try {
      const res = await api(`/areas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deliveryPrice: num }),
      })
      if (res.ok) {
        setAreas((prev) => prev.map((a) => (a._id === id ? { ...a, deliveryPrice: num } : a)))
        setEditingPriceId(null)
        setEditPriceValue('')
        showToast(t('Delivery fee updated.', 'تم تحديث رسوم التوصيل.'), undefined, 'success')
      }
    } finally {
      setLoading(false)
    }
  }

  const hasCountryCity = Boolean(initialCountry && initialCity)

  return (
    <div className="mt-8 space-y-8">
      {/* Tip: delivery pricing */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-4 sm:px-5 sm:py-5 flex gap-4 items-start">
        <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Sparkles className="size-10 animate-pulse text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-emerald-200 text-xl mb-1">
            {t('Delivery pricing tip', 'نصيحة لرسوم التوصيل')}
          </h3>
          <p className="text-base text-emerald-200/90 leading-relaxed mt-2">
            {t(
              'Set a fair delivery fee per area so drivers are encouraged to accept orders and customers stay comfortable completing theirs. Keep fees in line with local market rates (e.g. moderate range for your region) for the best results.',
              'حدد رسوماً عادلة للتوصيل لكل منطقة ليشجع السائقين على قبول الطلبات ويكون العملاء مرتاحين لإتمام الطلب. حافظ على الرسوم متناسقة مع أسعار السوق المحلية (مثلاً ضمن نطاق معتدل لمنطقتك) للحصول على أفضل النتائج.'
            )}
          </p>
        </div>
      </div>

      {/* Current delivery areas */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 dashboard-card">
        <h2 className="mb-4 font-semibold text-white text-base md:text-lg">{t('Your delivery areas', 'مناطق التوصيل الخاصة بك')}</h2>
        <ul className="space-y-3">
          {areas.map((a) => (
            <li key={a._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 min-h-[3.5rem]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.name_en}</span>
                <span className="text-slate-500">/ {a.name_ar}</span>
                <span className="text-slate-400">—</span>
                {editingPriceId === a._id ? (
                  <span className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t('Free', 'مجاني')}
                      value={editPriceValue}
                      onChange={(e) => setEditPriceValue(e.target.value)}
                      className="dashboard-input w-24 bg-slate-700 border-slate-600 text-white"
                    />
                    <span className="text-sm text-slate-500">{a.currency}</span>
                    <Button type="button" size="sm" className="min-h-10 bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={() => saveEditPrice(a._id)} disabled={loading}>
                      {t('Save', 'حفظ')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={cancelEditPrice}>
                      {t('Cancel', 'إلغاء')}
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditPrice(a)}
                    className="text-sm text-slate-400 hover:text-amber-400 hover:underline min-h-[2.5rem] flex items-center"
                    title={t('Change delivery fee', 'تغيير رسوم التوصيل')}
                  >
                    {a.deliveryPrice === 0 ? t('Free', 'مجاني') : `${a.deliveryPrice} ${a.currency}`}
                  </button>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 size-10 text-red-400" onClick={() => handleDelete(a._id)} disabled={loading} aria-label={t('Remove area', 'إزالة المنطقة')}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        {areas.length === 0 && <p className="py-4 text-sm text-slate-500">{t('No delivery areas yet. Quick-add from your city below or add a custom area.', 'لا توجد مناطق توصيل بعد. أضف من مدينتك أدناه أو أضف منطقة مخصصة.')}</p>}
      </div>

      {/* Quick add from city */}
      {hasCountryCity && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 dashboard-card">
          <h2 className="mb-3 font-semibold text-white text-base md:text-lg">{t('Quick add from', 'إضافة سريعة من')} {initialCity}</h2>
          <p className="mb-4 text-xs text-slate-500">{t('Click + to add an area. Delivery fee defaults to Free; you can change it in the list above after adding.', 'انقر + لإضافة منطقة. رسوم التوصيل افتراضياً مجاني؛ يمكنك تغييرها في القائمة أعلاه بعد الإضافة.')}</p>
          {suggestedAreas.length === 0 ? (
            <p className="text-sm text-slate-500">{t('No suggested areas for this city yet. Add a custom area below; it will then be available for other businesses in your city.', 'لا توجد مناطق مقترحة لهذه المدينة بعد. أضف منطقة مخصصة أدناه؛ ستكون متاحة لباقي الأعمال في مدينتك.')}</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {suggestedAreas.map((s) => {
                const added = isAlreadyAdded(s.name_en, s.name_ar)
                return (
                  <li key={`${s.name_en}-${s.name_ar}`} className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 min-h-[3rem]">
                    <span className="text-sm font-medium text-white">{s.name_en}</span>
                    <span className="text-slate-500">/</span>
                    <span className="text-sm text-slate-400">{s.name_ar}</span>
                    {added ? (
                      <span className="ml-1 flex items-center gap-1 text-xs text-green-400">
                        <Check className="size-3.5" /> {t('Added', 'تمت الإضافة')}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-1 size-10 shrink-0 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                        onClick={() => handleQuickAdd(s)}
                        disabled={loading}
                        aria-label={t('Add', 'إضافة') + ' ' + s.name_en}
                      >
                        <Plus className="size-4" />
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {!hasCountryCity && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4 text-sm text-amber-200/90">
          {t('Set your business Country & City in Manage Business to see quick-add areas for your city.', 'حدد بلد ومدينة العمل في إدارة العمل لرؤية مناطق الإضافة السريعة لمدينتك.')}
        </p>
      )}

      {/* Add custom area */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 dashboard-card">
        <h2 className="mb-3 font-semibold text-white text-base md:text-lg">{t('Add custom area', 'إضافة منطقة مخصصة')}</h2>
        <p className="mb-4 text-xs text-slate-500">
          {t('Add an area that isn’t in the list above. Default delivery fee is Free; you can change it after adding.', 'أضف منطقة غير موجودة في القائمة أعلاه. رسوم التوصيل الافتراضية مجاني؛ يمكنك تغييرها بعد الإضافة.')}
        </p>
        {addingCustom ? (
          <form onSubmit={handleAddCustom} className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Input name="name_en" placeholder={t('Area name (EN)', 'اسم المنطقة (EN)')} className="dashboard-input flex-1 min-w-[140px] bg-slate-800 border-slate-600 text-white" required />
              <Input name="name_ar" placeholder={t('Area name (AR)', 'اسم المنطقة (AR)')} className="dashboard-input flex-1 min-w-[140px] bg-slate-800 border-slate-600 text-white" required />
              <Input
                name="deliveryPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder={t('Free', 'مجاني')}
                className="dashboard-input w-28 bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" size="sm" className="min-h-11 px-5 bg-amber-500 text-slate-950 hover:bg-amber-400" disabled={loading}>
                {t('Add area', 'إضافة منطقة')}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setAddingCustom(false)}>
                {t('Cancel', 'إلغاء')}
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" size="sm" className="min-h-11 px-5 bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={() => setAddingCustom(true)}>
            <Plus className="mr-1.5 size-4" /> {t('Add custom area', 'إضافة منطقة مخصصة')}
          </Button>
        )}
      </div>
    </div>
  )
}
