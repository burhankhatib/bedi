'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Package, Loader2, Upload, ArrowLeft, RefreshCw } from 'lucide-react'
import { urlFor } from '@/sanity/lib/image'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { compressImageForUpload } from '@/lib/compress-image'
import { SALE_UNITS } from '@/lib/sale-units'

function friendlyError(message: string): { en: string; ar: string } {
  const m = (message || '').toLowerCase()
  if (m.includes('forbidden') || m.includes('403')) return { en: 'You do not have permission to add products.', ar: 'ليس لديك صلاحية لإضافة المنتجات.' }
  if (m.includes('category') && m.includes('not found')) return { en: 'Please select a menu category first.', ar: 'يرجى اختيار فئة القائمة أولاً.' }
  if (m.includes('not found') || m.includes('404')) return { en: 'Product or category was not found. Please try again.', ar: 'لم يتم العثور على المنتج أو الفئة. حاول مرة أخرى.' }
  if (m.includes('unsplash') || m.includes('unsplash_access_key')) return { en: 'Image service is not configured. Contact your admin to add UNSPLASH_ACCESS_KEY.', ar: 'خدمة الصور غير مهيأة. تواصل مع المشرف.' }
  if (m.includes('token') || m.includes('server config')) return { en: 'Server configuration error. Please contact support.', ar: 'خطأ في إعدادات الخادم. يرجى التواصل مع الدعم.' }
  if (m.includes('required')) return { en: 'Missing required information. Please check and try again.', ar: 'معلومات مطلوبة ناقصة. تحقق وحاول مرة أخرى.' }
  return { en: message || 'Something went wrong. Please try again.', ar: 'حدث خطأ. يرجى المحاولة مرة أخرى.' }
}

type CatalogProduct = {
  _id: string
  source: 'catalog' | 'tenant'
  title_en?: string
  title_ar?: string
  brand?: string
  price?: number
  currency?: string
  defaultUnit?: string
  saleUnit?: string
  image?: { asset?: { _ref?: string } }
  images?: Array<{ asset?: { _ref?: string } }>
  categoryTitle?: string
  categoryId?: string
}

type CatalogCategory = { _id: string; title_en: string; title_ar: string }
type MenuCategory = { _id: string; title_en: string; title_ar: string }
type MasterCatalogProduct = {
  _id: string
  nameEn?: string
  nameAr?: string
  category?: string
  searchQuery?: string
  unitType?: 'kg' | 'piece' | 'pack'
  alreadyAdded?: boolean
  image?: { asset?: { _ref?: string } }
}

export function CatalogProductsModal({
  open,
  onClose,
  categories,
  slug,
  onAdded,
  businessType,
}: {
  open: boolean
  onClose: () => void
  categories: MenuCategory[]
  slug: string
  onAdded: () => void
  businessType?: string
}) {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const [q, setQ] = useState('')
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([])
  const [selectedCatalogCategoryId, setSelectedCatalogCategoryId] = useState('')
  const [selectedMenuCategoryId, setSelectedMenuCategoryId] = useState('')
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [masterProducts, setMasterProducts] = useState<MasterCatalogProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [masterLoading, setMasterLoading] = useState(false)
  const [masterImageOptions, setMasterImageOptions] = useState<Record<string, { urls: string[]; selectedIndex: number; page: number }>>({})
  const [refreshImageId, setRefreshImageId] = useState<string | null>(null)
  const [addingMasterId, setAddingMasterId] = useState<string | null>(null)
  const [customizing, setCustomizing] = useState<CatalogProduct | null>(null)
  const [titleEn, setTitleEn] = useState('')
  const [titleAr, setTitleAr] = useState('')
  const [price, setPrice] = useState('')
  const [saleUnit, setSaleUnit] = useState('piece')
  const [selectedImageRef, setSelectedImageRef] = useState<string | null>(null)
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null)
  const [contributeImage, setContributeImage] = useState(true)
  const [adding, setAdding] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const menuCategoryId = selectedMenuCategoryId || categories[0]?._id || ''

  useEffect(() => {
    if (!selectedMenuCategoryId && categories[0]?._id) setSelectedMenuCategoryId(categories[0]._id)
  }, [categories, selectedMenuCategoryId])

  useEffect(() => {
    if (open && slug) {
      fetch(`/api/tenants/${slug}/catalog-categories`, { credentials: 'include' })
        .then((r) => r.json())
        .then((list) => setCatalogCategories(Array.isArray(list) ? list : []))
        .catch(() => setCatalogCategories([]))
    }
  }, [open, slug])

  const fetchProducts = useCallback(async () => {
    if (!open || !slug) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (selectedCatalogCategoryId) params.set('categoryId', selectedCatalogCategoryId)
      const res = await fetch(`/api/tenants/${slug}/catalog-products?${params}`, { credentials: 'include' })
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [open, slug, q, selectedCatalogCategoryId])

  const fetchImagesForProduct = useCallback(async (itemId: string, searchQuery: string, page = 1) => {
    if (!searchQuery) return { itemId, urls: [], page }
    try {
      const r = await fetch(`/api/catalog/image?query=${encodeURIComponent(searchQuery)}&count=5&page=${page}`)
      const j = await r.json()
      const urls = Array.isArray(j?.images)
        ? j.images.map((img: { imageUrlSmall?: string; imageUrl?: string }) => img.imageUrlSmall || img.imageUrl).filter(Boolean)
        : (j?.imageUrlSmall || j?.imageUrl) ? [j.imageUrlSmall || j.imageUrl] : []
      return { itemId, urls, page }
    } catch {
      return { itemId, urls: [], page }
    }
  }, [])

  const fetchMasterProducts = useCallback(async () => {
    if (!open || !slug || !businessType) return
    setMasterLoading(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      // Restaurant & cafe: show grocery (cheese, beverages) + bakery (bread) for meals/sandwiches
      if (businessType === 'restaurant' || businessType === 'cafe') {
        params.set('categories', 'grocery,bakery,restaurant,cafe')
        params.set('limit', '48')
      } else {
        const cat = businessType === 'supermarket' || businessType === 'greengrocer' ? 'grocery' : businessType
        params.set('category', cat)
      }
      if (!params.has('limit')) params.set('limit', '24')
      const res = await fetch(`/api/tenants/${slug}/master-catalog?${params}`, { credentials: 'include' })
      const data = await res.json()
      const list = Array.isArray(data) ? (data as MasterCatalogProduct[]) : []
      setMasterProducts(list)

      const pairs = await Promise.all(
        list.map(async (item) => {
          const imageRef = item.image?.asset?._ref
          if (imageRef) {
            const storedUrl = urlFor({ _type: 'image', asset: { _ref: imageRef } }).width(400).height(400).url()
            return [item._id, { urls: [storedUrl], selectedIndex: 0, page: 1 }] as const
          }
          const { itemId, urls } = await fetchImagesForProduct(item._id, item.searchQuery?.trim() ?? '', 1)
          return [itemId, { urls, selectedIndex: 0, page: 1 }] as const
        })
      )
      setMasterImageOptions(Object.fromEntries(pairs))
    } catch {
      setMasterProducts([])
      setMasterImageOptions({})
    } finally {
      setMasterLoading(false)
    }
  }, [open, slug, q, businessType, fetchImagesForProduct])

  const refreshMasterImages = useCallback(async (item: MasterCatalogProduct) => {
    const query = item.searchQuery?.trim()
    if (!query) return
    setRefreshImageId(item._id)
    try {
      const { urls, page } = await fetchImagesForProduct(item._id, query, ((masterImageOptions[item._id]?.page ?? 1) + 1))
      setMasterImageOptions((prev) => ({
        ...prev,
        [item._id]: { urls, selectedIndex: 0, page },
      }))
    } finally {
      setRefreshImageId(null)
    }
  }, [fetchImagesForProduct, masterImageOptions])

  useEffect(() => {
    const debounce = setTimeout(fetchProducts, 300)
    return () => clearTimeout(debounce)
  }, [fetchProducts])

  useEffect(() => {
    const debounce = setTimeout(fetchMasterProducts, 300)
    return () => clearTimeout(debounce)
  }, [fetchMasterProducts])

  const startCustomize = (product: CatalogProduct) => {
    setCustomizing(product)
    setTitleEn(product.title_en ?? '')
    setTitleAr(product.title_ar ?? '')
    setPrice(product.price != null ? String(product.price) : '')
    setSaleUnit(product.defaultUnit ?? product.saleUnit ?? 'piece')
    setSelectedImageRef(null)
    setUploadedImageId(null)
    setContributeImage(true)
    const imgs = product.source === 'catalog' && product.images?.length ? product.images : product.image ? [product.image] : []
    if (imgs[0]?.asset?._ref) setSelectedImageRef(imgs[0].asset._ref)
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    try {
      const compressed = await compressImageForUpload(file)
      const fd = new FormData()
      fd.append('file', compressed)
      const res = await fetch(`/api/tenants/${slug}/upload`, { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?._id) {
        setUploadedImageId(data._id)
        setSelectedImageRef(null)
      } else {
        const msg = friendlyError((data as { error?: string })?.error ?? 'Upload failed')
        showToast(msg.en, msg.ar, 'error')
      }
    } catch {
      showToast(t('Image upload failed. Please try again.', 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.'), '', 'error')
    }
    e.target.value = ''
  }

  const handleAddCustomized = async () => {
    if (!customizing || !menuCategoryId || categories.length === 0) return
    const priceNum = parseFloat(price)
    if (Number.isNaN(priceNum) || priceNum < 0) {
      showToast(t('Please enter a valid price.', 'يرجى إدخال سعر صحيح.'), '', 'error')
      return
    }
    const imageAssetId = uploadedImageId || selectedImageRef
    setAdding(true)
    try {
      const res = await fetch(`/api/tenants/${slug}/products/from-catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: customizing._id,
          categoryId: menuCategoryId,
          price: priceNum,
          saleUnit: saleUnit || 'piece',
          title_en: titleEn.trim() || customizing.title_en,
          title_ar: titleAr.trim() || customizing.title_ar,
          imageAssetId: imageAssetId || undefined,
          contributeImage: customizing.source === 'catalog' && contributeImage && !!uploadedImageId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(t('Product added to your menu.', 'تمت إضافة المنتج إلى قائمتك.'), '', 'success')
        onAdded()
        onClose()
      } else {
        const msg = friendlyError((data as { error?: string })?.error ?? '')
        showToast(msg.en, msg.ar, 'error')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleQuickAddMaster = async (item: MasterCatalogProduct) => {
    if (!menuCategoryId || !item._id || addingMasterId) return
    const opts = masterImageOptions[item._id]
    const hasStoredImage = !!item.image?.asset?._ref
    const selectedUrl = !hasStoredImage && opts?.urls?.length ? opts.urls[opts.selectedIndex ?? 0] : undefined
    setAddingMasterId(item._id)
    try {
      const res = await fetch(`/api/tenants/${slug}/products/from-catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          masterCatalogId: item._id,
          categoryId: menuCategoryId,
          title_en: item.nameEn,
          title_ar: item.nameAr,
          saleUnit: item.unitType || 'piece',
          unsplashImageUrl: selectedUrl || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(t('Product added to your menu.', 'تمت إضافة المنتج إلى قائمتك.'), '', 'success')
        setMasterProducts((prev) => prev.map((p) => (p._id === item._id ? { ...p, alreadyAdded: true } : p)))
        onAdded()
      } else {
        const msg = friendlyError((data as { error?: string })?.error ?? '')
        showToast(msg.en, msg.ar, 'error')
      }
    } finally {
      setAddingMasterId(null)
    }
  }

  const setSelectedMasterImage = (itemId: string, index: number) => {
    setMasterImageOptions((prev) => {
      const opts = prev[itemId]
      if (!opts) return prev
      return { ...prev, [itemId]: { ...opts, selectedIndex: index } }
    })
  }

  const title = (p: CatalogProduct) => (lang === 'ar' ? (p.title_ar || p.title_en) : (p.title_en || p.title_ar))
  const catalogImages = customizing?.source === 'catalog' && customizing.images?.length
    ? customizing.images
    : customizing?.image ? [customizing.image] : []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (setCustomizing(null), onClose())}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden flex flex-col bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {customizing ? t('Customize & add', 'تخصيص وإضافة') : t('Add from catalog', 'إضافة من الكتالوج')}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {customizing
              ? t('Edit name, pick or upload image, set your price. Then add to your menu.', 'عدّل الاسم، اختر أو ارفع صورة، حدد السعر. ثم أضف إلى قائمتك.')
              : categories.length === 0
                ? t('Create at least one category first.', 'أنشئ فئة واحدة على الأقل أولاً.')
                : t('Browse products. Click one to customize name, image, and price before adding.', 'استعرض المنتجات. انقر واحداً لتخصيص الاسم والصورة والسعر قبل الإضافة.')}
          </DialogDescription>
        </DialogHeader>

        {customizing ? (
          <div className="flex flex-col gap-4">
            <Button variant="ghost" size="sm" className="self-start text-slate-400" onClick={() => setCustomizing(null)}>
              <ArrowLeft className="mr-2 size-4" />
              {t('Back', 'رجوع')}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Title (English)</label>
                <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Title (Arabic)</label>
                <Input dir="rtl" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Price (ILS) *</label>
                <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-slate-800 border-slate-600 text-white" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">{t('Sold by', 'يباع بـ')}</label>
                <select value={saleUnit} onChange={(e) => setSaleUnit(e.target.value)} className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white">
                  {SALE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{lang === 'ar' ? u.label_ar : u.label_en}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Image</label>
              <div className="flex flex-wrap gap-2">
                {catalogImages.map((img) => {
                  const ref = img?.asset?._ref
                  if (!ref) return null
                  const isSelected = selectedImageRef === ref && !uploadedImageId
                  return (
                    <button
                      key={ref}
                      type="button"
                      onClick={() => { setSelectedImageRef(ref); setUploadedImageId(null) }}
                      className={`relative size-16 rounded-lg overflow-hidden border-2 shrink-0 ${isSelected ? 'border-amber-500' : 'border-slate-600'}`}
                    >
                      <Image src={urlFor({ _type: 'image', asset: { _ref: ref } }).width(80).height(80).url()} alt="" fill className="object-cover" sizes="64px" />
                    </button>
                  )
                })}
                <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/50 text-slate-500 hover:border-slate-500 hover:text-slate-400"
                >
                  <Upload className="size-6" />
                </button>
              </div>
              {uploadedImageId && (
                <p className="mt-1 text-xs text-amber-400">{t('New image uploaded. It will be used for this product.', 'تم رفع صورة جديدة. ستُستخدم لهذا المنتج.')}</p>
              )}
              {customizing.source === 'catalog' && uploadedImageId && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={contributeImage} onChange={(e) => setContributeImage(e.target.checked)} className="rounded" />
                  {t('Contribute this image to catalog for other markets', 'إضافة هذه الصورة للكتالوج لاستخدامها من أسواق أخرى')}
                </label>
              )}
            </div>
            <Button onClick={handleAddCustomized} disabled={adding} className="bg-amber-600 hover:bg-amber-500">
              {adding ? <Loader2 className="size-4 animate-spin" /> : t('Add to my menu', 'إضافة إلى قائمتي')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <Input type="search" placeholder={t('Search products…', 'ابحث عن منتجات...')} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-slate-800 border-slate-600 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">{t('Catalog category', 'فئة الكتالوج')}</label>
                  <select value={selectedCatalogCategoryId} onChange={(e) => setSelectedCatalogCategoryId(e.target.value)} className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white">
                    <option value="">{t('All', 'الكل')}</option>
                    {catalogCategories.map((c) => (
                      <option key={c._id} value={c._id}>{lang === 'ar' ? c.title_ar : c.title_en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">{t('Add to my category', 'إضافة إلى فئتي')}</label>
                  <select value={selectedMenuCategoryId} onChange={(e) => setSelectedMenuCategoryId(e.target.value)} className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white">
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{lang === 'ar' ? c.title_ar : c.title_en}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-slate-700 bg-slate-800/50 p-3 space-y-6">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    {t('Master catalog quick add', 'إضافة سريعة من الكتالوج الرئيسي')}
                  </h3>
                  {masterLoading && <Loader2 className="size-4 animate-spin text-emerald-400" />}
                </div>
                {masterProducts.length === 0 && !masterLoading ? (
                  <p className="text-xs text-slate-500">
                    {t(
                      'No master catalog items found. Ask your admin to seed the master catalog at Admin → Catalog.',
                      'لا توجد عناصر. اطلب من المشرف تشغيل البذر في الإدارة → الكتالوج.'
                    )}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {masterProducts.map((item) => {
                      const opts = masterImageOptions[item._id]
                      const urls = opts?.urls ?? []
                      const selectedIdx = opts?.selectedIndex ?? 0
                      const displayUrl = urls[selectedIdx] || urls[0]
                      const displayName = lang === 'ar' ? (item.nameAr || item.nameEn) : (item.nameEn || item.nameAr)
                      const isAdded = item.alreadyAdded === true
                      const isAdding = addingMasterId === item._id
                      const isRefreshing = refreshImageId === item._id
                      return (
                        <div
                          key={item._id}
                          className="rounded-xl border border-slate-600 bg-slate-800 overflow-hidden"
                        >
                          <div className="relative aspect-square bg-slate-700">
                            {displayUrl ? (
                              <Image src={displayUrl} alt={displayName || ''} fill className="object-cover" sizes="120px" unoptimized />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Package className="size-10 text-slate-500" />
                              </div>
                            )}
                          </div>
                          {urls.length > 0 && !isAdded && (
                            <div className="px-2 pt-1.5 flex flex-wrap gap-1 items-center">
                              {urls.map((url, idx) => (
                                <button
                                  key={url}
                                  type="button"
                                  onClick={() => setSelectedMasterImage(item._id, idx)}
                                  className={`relative size-8 rounded overflow-hidden shrink-0 border-2 transition-colors ${
                                    selectedIdx === idx ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-600 hover:border-slate-500'
                                  }`}
                                >
                                  <Image src={url} alt="" fill className="object-cover" sizes="32px" unoptimized />
                                </button>
                              ))}
                              {!item.image?.asset?._ref && item.searchQuery && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 shrink-0 text-slate-500 hover:text-emerald-400"
                                  onClick={() => refreshMasterImages(item)}
                                  disabled={isRefreshing}
                                  title={t('Refresh images', 'تحديث الصور')}
                                >
                                  {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                                </Button>
                              )}
                            </div>
                          )}
                          <div className="p-2 space-y-1">
                            <p className="text-sm font-bold text-white line-clamp-2">{displayName}</p>
                            {item.unitType && <p className="text-[10px] text-slate-400 uppercase">{item.unitType}</p>}
                            {isAdded ? (
                              <span className="inline-flex rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                {t('Added', 'تمت الإضافة')}
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleQuickAddMaster(item)}
                                disabled={isAdding || !menuCategoryId}
                                className="h-7 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                              >
                                {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : t('Quick Add', 'إضافة سريعة')}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('Catalog browser (customize)', 'متصفح الكتالوج (تخصيص)')}
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-amber-500" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <Package className="size-12 mb-3 opacity-50" />
                    <p className="text-sm text-center">
                      {q ? t('No matching products found.', 'لم يُعثَر على منتجات مطابقة.') : t('No products yet. Seed the catalog (admin) or add products from other markets.', 'لا توجد منتجات بعد. قم بتهيئة الكتالوج (مشرف) أو أضف منتجات من أسواق أخرى.')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {products.map((p) => {
                      const imgRef = (p.images?.[0] ?? p.image)?.asset?._ref
                      return (
                        <button
                          key={`${p._id}-${p.source}`}
                          type="button"
                          onClick={() => startCustomize(p)}
                          className="flex flex-col rounded-xl border border-slate-600 bg-slate-800 overflow-hidden text-left hover:border-amber-500/50 transition-colors"
                        >
                          <div className="relative aspect-square bg-slate-700">
                            {imgRef ? (
                              <Image src={urlFor({ _type: 'image', asset: { _ref: imgRef } }).width(200).height(200).url()} alt={title(p) ?? ''} fill className="object-cover" sizes="120px" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Package className="size-10 text-slate-500" />
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-sm font-bold text-white line-clamp-2">{title(p)}</p>
                            {p.brand && <p className="text-[10px] text-slate-500 mt-0.5">{p.brand}</p>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
