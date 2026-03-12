'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Copy, ChevronDown, ChevronRight, GripVertical, AlertTriangle, Package } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { useTenantBusiness } from '../TenantBusinessContext'
import { CatalogProductsModal } from './CatalogProductsModal'
import { usePusherStream } from '@/lib/usePusherStream'
import { ProductFormModal, type ProductFormData } from './ProductFormModal'

function SortableItem({
  id,
  children,
  className = '',
}: {
  id: string
  children: (handleProps: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined }) => React.ReactNode
  className?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children({
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: listeners as unknown as Record<string, unknown> | undefined,
      })}
    </div>
  )
}

function DroppableProductList({
  id,
  children,
  className = '',
  isEmpty = false,
}: {
  id: string
  children: React.ReactNode
  className?: string
  isEmpty?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <ul
      ref={setNodeRef}
      className={`space-y-2 rounded-lg transition-colors ${isEmpty ? 'min-h-[56px] py-3' : 'min-h-[24px]'} ${isOver ? 'ring-2 ring-amber-400/80 ring-inset bg-amber-500/10' : ''} ${className}`}
    >
      {children}
    </ul>
  )
}

const SORT_ORDER_GAP = 100

function SortableProduct({
  product,
  loading,
  currentCategoryId,
  categories,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
}: {
  product: { _id: string; title_en: string; price: number; currency: string }
  loading: boolean
  currentCategoryId: string
  categories: Array<{ _id: string; title_en: string }>
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (targetCategoryId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `product-${product._id}`,
  })
  const otherCategories = categories.filter((c) => c._id !== currentCategoryId)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <li ref={setNodeRef} style={style} className="rounded-lg bg-slate-800/50">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
        <button
          type="button"
          className="touch-none select-none flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-700/50 p-2 text-slate-500 hover:bg-slate-700 hover:text-slate-300 cursor-grab active:cursor-grabbing"
          title="Drag to reorder or move to another category"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <span className="min-w-0 flex-1 truncate">{product.title_en} — {product.price} {product.currency}</span>
        <div className="flex shrink-0 items-center gap-1">
          {otherCategories.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (v) onMove(v)
                e.target.value = ''
              }}
              disabled={loading}
              className="h-8 max-w-[140px] rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
              title="Move to category"
            >
              <option value="">Move to…</option>
              {otherCategories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.title_en}</option>
              ))}
            </select>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-400" onClick={onEdit} disabled={loading} title="Edit">
            <Pencil className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-400" onClick={onDuplicate} disabled={loading} title="Duplicate">
            <Copy className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-red-400" onClick={onDelete} disabled={loading} title="Delete">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </li>
  )
}

function ProductRow({
  product,
  loading,
  currentCategoryId,
  categories,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
}: {
  product: { _id: string; title_en: string; price: number; currency: string }
  loading: boolean
  currentCategoryId: string
  categories: Array<{ _id: string; title_en: string }>
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (targetCategoryId: string) => void
}) {
  const otherCategories = categories.filter((c) => c._id !== currentCategoryId)
  return (
    <li className="rounded-lg bg-slate-800/50">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
        <div className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-slate-600/40 bg-slate-800/30 p-2 text-slate-600">
          <GripVertical className="size-4 opacity-50" />
        </div>
        <span className="min-w-0 flex-1 truncate">{product.title_en} — {product.price} {product.currency}</span>
        <div className="flex shrink-0 items-center gap-1">
          {otherCategories.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (v) onMove(v)
                e.target.value = ''
              }}
              disabled={loading}
              className="h-8 max-w-[140px] rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
              title="Move to category"
            >
              <option value="">Move to…</option>
              {otherCategories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.title_en}</option>
              ))}
            </select>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-400" onClick={onEdit} disabled={loading} title="Edit">
            <Pencil className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-400" onClick={onDuplicate} disabled={loading} title="Duplicate">
            <Copy className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-red-400" onClick={onDelete} disabled={loading} title="Delete">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </li>
  )
}

type Category = { _id: string; title_en: string; title_ar: string; slug: string; sortOrder?: number; productSortMode?: string }

const SORT_STORAGE_KEY = 'menu-product-sort'
type ProductSortMode = 'manual' | 'name' | 'price'

function loadSortModes(slug: string): Record<string, ProductSortMode> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(`${SORT_STORAGE_KEY}-${slug}`)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>
      const out: Record<string, ProductSortMode> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (v === 'manual' || v === 'name' || v === 'price') out[k] = v
      }
      return out
    }
  } catch {
    // ignore
  }
  return {}
}

function saveSortModes(slug: string, modes: Record<string, ProductSortMode>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${SORT_STORAGE_KEY}-${slug}`, JSON.stringify(modes))
  } catch {
    // ignore
  }
}
type Product = {
  _id: string
  title_en: string
  title_ar: string
  description_en?: string
  description_ar?: string
  ingredients_en?: string[]
  ingredients_ar?: string[]
  price: number
  saleUnit?: string
  specialPrice?: number
  specialPriceExpires?: string
  currency: string
  categoryId: string
  sortOrder?: number
  isPopular?: boolean
  isAvailable?: boolean
  availableAgainAt?: string
  catalogRef?: string
  dietaryTags?: string[]
  addOns?: Array<{ name_en: string; name_ar: string; price: number }>
  variants?: Array<{ name_en: string; name_ar: string; options: Array<{ label_en: string; label_ar: string; priceModifier?: number }> }>
}

export function MenuManageClient({
  slug,
  siteId,
  initialCategories,
  initialProducts,
}: {
  slug: string
  siteId: string
  initialCategories: Category[]
  initialProducts: Product[]
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productModalProduct, setProductModalProduct] = useState<Product | null>(null)
  const [productModalCategoryId, setProductModalCategoryId] = useState<string | undefined>(undefined)
  const [savingProduct, setSavingProduct] = useState(false)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()
  const { t } = useLanguage()
  const { data } = useTenantBusiness()
  const businessType = data?.tenant?.businessType ?? ''
  const canUseCatalog = ['grocery', 'supermarket', 'greengrocer'].includes(businessType)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [sortModes, setSortModes] = useState<Record<string, ProductSortMode>>(() => loadSortModes(slug))
  const [reorderingCategoryId, setReorderingCategoryId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'category' | 'product'
    id: string
    nameEn: string
    nameAr?: string
  } | null>(null)

  const api = (path: string, options?: RequestInit) =>
    fetch(`/api/tenants/${slug}${path}`, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reloadCategories = useCallback(async () => {
    const res = await api('/categories')
    const data = await res.json()
    if (res.ok && Array.isArray(data)) setCategories(data)
  }, [slug])
  const reloadProducts = useCallback(async () => {
    const res = await api('/products')
    const data = await res.json()
    if (res.ok && Array.isArray(data)) {
      const list: Product[] = data.map((p: Product & { categoryRef?: string }) => ({
        ...p,
        categoryId: p.categoryId ?? p.categoryRef ?? '',
      }))
      setProducts(list)
    }
  }, [slug])

  const refreshMenu = useCallback(() => {
    reloadCategories()
    reloadProducts()
  }, [reloadCategories, reloadProducts])

  const refreshDebounceMs = 400
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshMenuDebounced = useCallback(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null
      refreshMenu()
    }, refreshDebounceMs)
  }, [refreshMenu])
  useEffect(() => () => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
  }, [])

  usePusherStream(siteId ? `tenant-${siteId}` : null, 'menu-update', refreshMenuDebounced)

  const [submittingCategory, setSubmittingCategory] = useState(false)
  const [sectionSuggestions, setSectionSuggestions] = useState<{ businessType?: string; commonSections: Array<{ title_en: string; title_ar: string }>; subcategories: Array<{ _id: string; title_en: string; title_ar: string }> } | null>(null)
  const [showCustomCategoryForm, setShowCustomCategoryForm] = useState(false)

  useEffect(() => {
    if (addingCategory && !sectionSuggestions) {
      api('/menu-section-suggestions')
        .then((r) => r.json())
        .then((d) => setSectionSuggestions({ businessType: d.businessType, commonSections: d.commonSections ?? [], subcategories: d.subcategories ?? [] }))
        .catch(() => setSectionSuggestions({ commonSections: [], subcategories: [] }))
    }
  }, [addingCategory, sectionSuggestions, slug])

  const addCategoryFromSuggestion = async (title_en: string, title_ar: string, subcategoryRef?: string) => {
    if (submittingCategory) return
    setSubmittingCategory(true)
    setLoading(true)
    try {
      const body: Record<string, unknown> = { title_en, title_ar }
      if (subcategoryRef) body.subcategoryRef = subcategoryRef
      const res = await api('/categories', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setAddingCategory(false)
        setShowCustomCategoryForm(false)
        showToast('Category added.', 'تمت إضافة الفئة.', 'success')
        const slugVal = (data as { slug?: string }).slug ?? (title_en || '').toLowerCase().replace(/\s+/g, '-')
        const newCat: Category = {
          _id: (data as { _id?: string })._id ?? '',
          title_en,
          title_ar,
          slug: slugVal,
          sortOrder: (data as { sortOrder?: number }).sortOrder ?? 0,
        }
        setCategories((prev) => [...prev, newCat])
        await reloadCategories()
      } else {
        showToast((data as { error?: string })?.error || 'Failed to add category', 'فشل في إضافة الفئة.', 'error')
      }
    } finally {
      setSubmittingCategory(false)
      setLoading(false)
    }
  }

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const title_en = (form.querySelector('[name="title_en"]') as HTMLInputElement).value.trim()
    const title_ar = (form.querySelector('[name="title_ar"]') as HTMLInputElement).value.trim()
    if (!title_en || !title_ar) return
    if (submittingCategory) return
    setSubmittingCategory(true)
    setLoading(true)
    try {
      const res = await api('/categories', { method: 'POST', body: JSON.stringify({ title_en, title_ar }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setAddingCategory(false)
        setShowCustomCategoryForm(false)
        showToast('Category added.', 'تمت إضافة الفئة.', 'success')
        const slug = (data as { slug?: string }).slug ?? (title_en || '').toLowerCase().replace(/\s+/g, '-')
        const newCat: Category = {
          _id: (data as { _id?: string })._id ?? '',
          title_en,
          title_ar,
          slug,
          sortOrder: (data as { sortOrder?: number }).sortOrder ?? 0,
        }
        setCategories((prev) => [...prev, newCat])
        await reloadCategories()
      } else {
        showToast(data?.error || 'Failed to add category', 'فشل في إضافة الفئة.', 'error')
      }
    } finally {
      setSubmittingCategory(false)
      setLoading(false)
    }
  }

  const buildProductBody = (data: ProductFormData) => {
    const variantsPayload = data.variants?.length
      ? data.variants.map((g) => ({
          name_en: g.name_en,
          name_ar: g.name_ar,
          required: g.required,
          options: g.options.map((o) => {
            const opt: Record<string, unknown> = {
              label_en: o.label_en,
              label_ar: o.label_ar,
              priceModifier: o.priceModifier ?? 0,
              ...(o.specialPriceModifier != null && { specialPriceModifier: o.specialPriceModifier }),
              ...(o.specialPriceModifierExpires != null && o.specialPriceModifierExpires !== '' && { specialPriceModifierExpires: o.specialPriceModifierExpires }),
              ...(o.isDefault === true && { isDefault: true }),
            }
            if (o.imageAssetId) {
              opt.image = { _type: 'image', asset: { _type: 'reference', _ref: o.imageAssetId } }
            }
            return opt
          }),
        }))
      : undefined
    const body: Record<string, unknown> = {
      title_en: data.title_en,
      title_ar: data.title_ar,
      description_en: data.description_en || undefined,
      description_ar: data.description_ar || undefined,
      ingredients_en: data.ingredients_en?.length ? data.ingredients_en : undefined,
      ingredients_ar: data.ingredients_ar?.length ? data.ingredients_ar : undefined,
      price: data.price,
      saleUnit: data.saleUnit || 'piece',
      specialPrice: data.specialPrice === '' ? null : data.specialPrice,
      specialPriceExpires: data.specialPriceExpires ? data.specialPriceExpires : null,
      currency: data.currency,
      categoryId: data.categoryId,
      sortOrder: data.sortOrder,
      isPopular: data.isPopular,
      isAvailable: data.isAvailable,
      availableAgainAt: data.availableAgainAt || undefined,
      dietaryTags: data.dietaryTags?.length ? data.dietaryTags : undefined,
      addOns: data.addOns?.length ? data.addOns : undefined,
      variants: variantsPayload,
      imageAssetId: data.imageAssetId || undefined,
      additionalImageAssetIds: Array.isArray(data.additionalImageAssetIds) ? data.additionalImageAssetIds : undefined,
      imageUrl: !data.imageAssetId && data.imageUrl?.trim() ? data.imageUrl.trim() : undefined,
      additionalImageUrls: !data.additionalImageAssetIds?.length && data.additionalImageUrls?.length ? data.additionalImageUrls : undefined,
      contributeImageToCatalog: data.contributeImageToCatalog === true ? true : undefined,
    }
    return body
  }

  const handleSaveProduct = async (data: ProductFormData) => {
    setSavingProduct(true)
    try {
      const body = buildProductBody(data)
      if (productModalProduct?._id) {
        const res = await api(`/products/${productModalProduct._id}`, { method: 'PATCH', body: JSON.stringify(body) })
        const patched = await res.json().catch(() => null)
        if (res.ok) {
          await reloadProducts()
          showToast('Product updated.', 'تم تحديث المنتج.', 'success')
        } else {
          const msg = res.status === 403
            ? 'Session may have expired. Please sign in again.'
            : (patched as { error?: string })?.error || 'Failed to update product'
          showToast(msg, res.status === 403 ? 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' : 'فشل في تحديث المنتج.', 'error')
          setProductModalOpen(true)
          return
        }
      } else {
        const res = await api('/products', { method: 'POST', body: JSON.stringify(body) })
        const created = await res.json().catch(() => null)
        if (res.ok && created?._id) {
          const categoryRef = (created as { category?: { _ref?: string } }).category?._ref ?? data.categoryId
          const newProduct: Product = {
            _id: created._id,
            title_en: created.title_en ?? data.title_en,
            title_ar: created.title_ar ?? data.title_ar,
            description_en: created.description_en,
            description_ar: created.description_ar,
            ingredients_en: created.ingredients_en,
            ingredients_ar: created.ingredients_ar,
            price: created.price ?? data.price,
            saleUnit: (created as { saleUnit?: string }).saleUnit ?? data.saleUnit,
            specialPrice: created.specialPrice,
            specialPriceExpires: created.specialPriceExpires,
            currency: created.currency ?? data.currency,
            categoryId: categoryRef,
            sortOrder: created.sortOrder ?? data.sortOrder,
            isPopular: created.isPopular ?? data.isPopular,
            isAvailable: created.isAvailable !== false,
            dietaryTags: created.dietaryTags,
            addOns: created.addOns,
            variants: created.variants,
          }
          setProducts((prev) => [...prev, newProduct])
          showToast('Product added.', 'تمت إضافة المنتج.', 'success')
          await reloadProducts()
        } else if (!res.ok) {
          const msg = res.status === 403
            ? 'Session may have expired. Please sign in again.'
            : (created as { error?: string })?.error || 'Failed to add product'
          showToast(msg, res.status === 403 ? 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' : 'فشل في إضافة المنتج.', 'error')
          setProductModalOpen(true)
          return
        }
      }
      setProductModalOpen(false)
      setProductModalProduct(null)
    } finally {
      setSavingProduct(false)
    }
  }

  const getCategoryProducts = useCallback((categoryId: string) => {
    const seen = new Set<string>()
    return products
      .filter((p) => p.categoryId === categoryId && !seen.has(p._id) && (seen.add(p._id), true))
      .sort((a, b) => {
        const orderA = a.sortOrder ?? 999999
        const orderB = b.sortOrder ?? 999999
        if (orderA !== orderB) return orderA - orderB
        return (a._id || '').localeCompare(b._id || '')
      })
  }, [products])

  const getSortedCategoryProducts = useCallback(
    (categoryId: string, mode: ProductSortMode): Product[] => {
      const list = getCategoryProducts(categoryId)
      if (mode === 'manual') return list
      if (mode === 'name') {
        return [...list].sort((a, b) => {
          const cmp = (a.title_en || '').toLowerCase().localeCompare((b.title_en || '').toLowerCase())
          return cmp !== 0 ? cmp : (a._id || '').localeCompare(b._id || '')
        })
      }
      return [...list].sort((a, b) => {
        const pa = a.price
        const pb = b.price
        if (pa !== pb) return pa - pb
        return (a._id || '').localeCompare(b._id || '')
      })
    },
    [getCategoryProducts]
  )

  const reorderCategories = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= categories.length) return
    const next = [...categories]
    const [removed] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, removed)
    const withNewOrder = next.map((cat, index) => ({ ...cat, sortOrder: index }))
    setCategories(withNewOrder)
    try {
      await Promise.all(withNewOrder.map((cat) => api(`/categories/${cat._id}`, { method: 'PATCH', body: JSON.stringify({ sortOrder: cat.sortOrder }) })))
      showToast('Category order updated.', 'تم تحديث ترتيب الفئات.', 'success')
    } catch {
      showToast('Failed to save category order', 'فشل حفظ ترتيب الفئات', 'error')
      reloadCategories()
    }
  }, [categories, api, showToast, reloadCategories])

  const reorderCategoryProducts = useCallback(async (categoryId: string, fromIndex: number, toIndex: number) => {
    if (reorderingCategoryId) return
    const categoryProducts = getCategoryProducts(categoryId)
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex > categoryProducts.length) return
    setReorderingCategoryId(categoryId)
    const next = [...categoryProducts]
    const [removed] = next.splice(fromIndex, 1)
    const insertAt = Math.min(toIndex, next.length)
    next.splice(insertAt, 0, removed)
    const updates = next.map((p, index) => ({ ...p, sortOrder: index * SORT_ORDER_GAP }))
    setProducts((prev) =>
      prev.map((p) => {
        if (p.categoryId !== categoryId) return p
        const u = updates.find((u) => u._id === p._id)
        return u ? { ...p, sortOrder: u.sortOrder } : p
      })
    )
    try {
      const res = await api('/products/reorder', {
        method: 'POST',
        body: JSON.stringify({ updates: updates.map((p) => ({ _id: p._id, sortOrder: p.sortOrder })) }),
      })
      if (res.ok) {
        showToast('Order updated.', 'تم تحديث الترتيب.', 'success')
      } else {
        showToast('Failed to save order', 'فشل حفظ الترتيب', 'error')
        reloadProducts()
      }
    } catch {
      showToast('Failed to save order', 'فشل حفظ الترتيب', 'error')
      reloadProducts()
    } finally {
      setReorderingCategoryId(null)
    }
  }, [getCategoryProducts, api, showToast, reloadProducts, reorderingCategoryId])

  const moveProductToCategory = useCallback(
    async (productId: string, targetCategoryId: string, insertAfterProductId?: string) => {
      if (reorderingCategoryId) return
      const product = products.find((p) => p._id === productId)
      if (!product) return
      setReorderingCategoryId(targetCategoryId)
      const targetProducts = getCategoryProducts(targetCategoryId)
      const isSameCategory = product.categoryId === targetCategoryId
      if (isSameCategory && insertAfterProductId) {
        const fromIndex = targetProducts.findIndex((p) => p._id === productId)
        const toIndex = targetProducts.findIndex((p) => p._id === insertAfterProductId)
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return
        await reorderCategoryProducts(targetCategoryId, fromIndex, toIndex)
        return
      }
      if (isSameCategory && !insertAfterProductId) return
      const insertIndex = insertAfterProductId
        ? targetProducts.findIndex((p) => p._id === insertAfterProductId) + 1
        : targetProducts.length
      const reordered = [...targetProducts.filter((p) => p._id !== productId)]
      reordered.splice(Math.min(insertIndex, reordered.length), 0, product)
      const updates = reordered.map((p, i) => ({ ...p, sortOrder: i * SORT_ORDER_GAP }))
      setProducts((prev) =>
        prev.map((p) => {
          if (p.categoryId !== targetCategoryId && p._id !== productId) return p
          const u = updates.find((u) => u._id === p._id)
          if (u) return { ...p, categoryId: targetCategoryId, sortOrder: u.sortOrder }
          if (p._id === productId) return { ...p, categoryId: targetCategoryId, sortOrder: updates.find((u) => u._id === productId)?.sortOrder ?? insertIndex }
          return p
        })
      )
      try {
        const reorderUpdates = updates.map((p) => ({
          _id: p._id,
          sortOrder: p.sortOrder,
          ...(p._id === productId ? { categoryId: targetCategoryId } : {}),
        }))
        const res = await api('/products/reorder', {
          method: 'POST',
          body: JSON.stringify({ updates: reorderUpdates }),
        })
        if (res.ok) {
          showToast('Product moved.', 'تم نقل المنتج.', 'success')
        } else {
          showToast('Failed to move product', 'فشل نقل المنتج', 'error')
          reloadProducts()
        }
      } catch {
        showToast('Failed to move product', 'فشل نقل المنتج', 'error')
        reloadProducts()
      } finally {
        setReorderingCategoryId(null)
      }
    },
    [products, getCategoryProducts, api, showToast, reloadProducts, reorderCategoryProducts, reorderingCategoryId]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const activeStr = String(active.id)
      const overStr = String(over.id)
      if (activeStr.startsWith('cat-')) {
        const from = parseInt(activeStr.replace(/^cat-/, ''), 10)
        const to = parseInt(overStr.replace(/^cat-/, ''), 10)
        if (!Number.isNaN(from) && !Number.isNaN(to) && from !== to) reorderCategories(from, to)
        return
      }
      if (activeStr.startsWith('product-')) {
        const productId = activeStr.replace(/^product-/, '')
        let targetCategoryId: string
        let insertAfterProductId: string | undefined
        if (overStr.startsWith('drop-category-')) {
          targetCategoryId = overStr.replace(/^drop-category-/, '')
        } else if (overStr.startsWith('product-')) {
          const targetProductId = overStr.replace(/^product-/, '')
          const targetProduct = products.find((p) => p._id === targetProductId)
          if (!targetProduct || targetProductId === productId) return
          targetCategoryId = targetProduct.categoryId
          insertAfterProductId = targetProductId
        } else if (overStr.startsWith('cat-')) {
          const catIndex = parseInt(overStr.replace(/^cat-/, ''), 10)
          const targetCat = categories[catIndex]
          if (!targetCat) return
          targetCategoryId = targetCat._id
        } else return
        moveProductToCategory(productId, targetCategoryId, insertAfterProductId)
      }
    },
    [reorderCategories, products, moveProductToCategory]
  )

  const openAddProduct = (categoryId: string) => {
    setProductModalCategoryId(categoryId)
    setProductModalProduct(null)
    setProductModalOpen(true)
  }
  const openEditProduct = (product: Product) => {
    setProductModalCategoryId(undefined)
    setProductModalProduct(product)
    setProductModalOpen(true)
  }

  const doDeleteCategory = async (id: string) => {
    setLoading(true)
    try {
      const res = await api(`/categories/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(t('Category deleted.', 'تم حذف الفئة.'), undefined, 'success')
        await reloadCategories()
        await reloadProducts()
      } else {
        showToast(data?.error || t('Could not delete category.', 'تعذر حذف الفئة.'), undefined, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const doDeleteProduct = async (id: string) => {
    setLoading(true)
    try {
      const res = await api(`/products/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(t('Product deleted.', 'تم حذف المنتج.'), undefined, 'success')
        await reloadProducts()
      } else {
        showToast(data?.error || t('Could not delete product.', 'تعذر حذف المنتج.'), undefined, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!deleteConfirm) return
    const { type, id } = deleteConfirm
    setDeleteConfirm(null)
    if (type === 'category') await doDeleteCategory(id)
    else await doDeleteProduct(id)
  }

  const setSortModeForCategory = useCallback(async (categoryId: string, mode: ProductSortMode) => {
    setSortModes((prev) => {
      const next = { ...prev, [categoryId]: mode }
      saveSortModes(slug, next)
      return next
    })
    setCategories((prev) => prev.map((c) => (c._id === categoryId ? { ...c, productSortMode: mode } : c)))
    try {
      await api(`/categories/${categoryId}`, { method: 'PATCH', body: JSON.stringify({ productSortMode: mode }) })
    } catch {
      showToast('Failed to save sort preference', 'فشل حفظ تفضيل الترتيب', 'error')
      reloadCategories()
    }
  }, [slug, api, showToast, reloadCategories])

  const handleDuplicateProduct = async (product: Product) => {
    setLoading(true)
    try {
      const res = await api('/products/duplicate', {
        method: 'POST',
        body: JSON.stringify({ productId: product._id }),
      })
      const created = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = (created as { error?: string })?.error || 'Could not duplicate product.'
        showToast(msg, 'تعذر نسخ المنتج.', 'error')
        return
      }
      await reloadProducts()
      const createdProduct: Product = {
        _id: (created as { _id: string })._id,
        title_en: (created as { title_en?: string }).title_en ?? product.title_en,
        title_ar: (created as { title_ar?: string }).title_ar ?? product.title_ar,
        description_en: (created as { description_en?: string }).description_en,
        description_ar: (created as { description_ar?: string }).description_ar,
        ingredients_en: (created as { ingredients_en?: string[] }).ingredients_en,
        ingredients_ar: (created as { ingredients_ar?: string[] }).ingredients_ar,
        price: (created as { price?: number }).price ?? product.price,
        specialPrice: (created as { specialPrice?: number }).specialPrice,
        specialPriceExpires: (created as { specialPriceExpires?: string }).specialPriceExpires,
        currency: (created as { currency?: string }).currency ?? product.currency,
        categoryId: (created as { category?: { _ref?: string } }).category?._ref ?? product.categoryId,
        sortOrder: (created as { sortOrder?: number }).sortOrder,
        isPopular: (created as { isPopular?: boolean }).isPopular,
        isAvailable: (created as { isAvailable?: boolean }).isAvailable !== false,
        availableAgainAt: (created as { availableAgainAt?: string }).availableAgainAt,
        dietaryTags: (created as { dietaryTags?: string[] }).dietaryTags,
        addOns: (created as { addOns?: Product['addOns'] }).addOns,
        variants: (created as { variants?: Product['variants'] }).variants,
        ...(typeof (created as { image?: { asset?: { _ref?: string } } }).image?.asset?._ref === 'string' && {
          image: (created as { image: { asset: { _ref: string } } }).image,
        }),
        ...(Array.isArray((created as { additionalImages?: unknown[] }).additionalImages) && {
          additionalImages: (created as { additionalImages: unknown[] }).additionalImages,
        }),
      }
      showToast('Product duplicated. You can edit the copy below.', 'تم نسخ المنتج. يمكنك تعديل النسخة أدناه.', 'success')
      openEditProduct(createdProduct)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent
          className="border-slate-700 bg-slate-900 text-white"
          showCloseButton={true}
          overlayClassName="z-[100]"
          contentClassName="z-[100]"
        >
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="size-6 text-red-400" />
              </div>
              <div className="min-w-0 pt-0.5">
                <DialogTitle className="text-lg text-white">
                  {deleteConfirm?.type === 'category'
                    ? t('Delete this category?', 'حذف هذه الفئة؟')
                    : t('Delete this product?', 'حذف هذا المنتج؟')}
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-2 leading-relaxed">
                  {deleteConfirm?.type === 'category' ? (
                    <>
                      {t(
                        'This will permanently delete the category and all products in it. This cannot be undone.',
                        'سيتم حذف الفئة وجميع المنتجات فيها نهائياً. لا يمكن التراجع عن ذلك.'
                      )}
                      {deleteConfirm?.nameEn && (
                        <span className="block mt-2 font-medium text-slate-300">
                          « {deleteConfirm.nameEn}
                          {deleteConfirm.nameAr ? ` / ${deleteConfirm.nameAr}` : ''} »
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {t(
                        'This will permanently delete this product. This cannot be undone.',
                        'سيتم حذف هذا المنتج نهائياً. لا يمكن التراجع عن ذلك.'
                      )}
                      {deleteConfirm?.nameEn && (
                        <span className="block mt-2 font-medium text-slate-300">« {deleteConfirm.nameEn} »</span>
                      )}
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-4 mt-6">
            <Button
              type="button"
              variant="default"
              className="border-slate-600 text-slate-200 hover:bg-slate-800 cursor-pointer"
              onClick={() => setDeleteConfirm(null)}
            >
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              onClick={onConfirmDelete}
              disabled={loading}
            >
              {t('Delete', 'حذف')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Categories</h2>
            <p className="text-sm text-slate-400">Add categories (e.g. Starters, Mains). Drag categories to reorder. Drag products to reorder within a category or move between categories.</p>
          </div>
          {canUseCatalog && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:border-amber-500/70"
              onClick={() => setCatalogOpen(true)}
            >
              <Package className="mr-2 size-4" />
              {t('Add from catalog', 'إضافة من الكتالوج')}
            </Button>
          )}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((_, i) => `cat-${i}`)} strategy={verticalListSortingStrategy}>
            <ul className="mt-4 space-y-2">
              {categories.map((c, catIndex) => (
                <SortableItem key={`cat-${c._id}-${catIndex}`} id={`cat-${catIndex}`} className="rounded-lg border border-slate-700/50 bg-slate-800/30">
                  {({ attributes, listeners }) => (
                    <>
                      <div
                        className="flex cursor-pointer items-center justify-between px-4 py-3"
                        onClick={() => setExpandedCat(expandedCat === c._id ? null : c._id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            className="touch-none select-none flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-700/50 p-2 text-slate-400 hover:bg-slate-700 hover:text-slate-200 cursor-grab active:cursor-grabbing"
                            title="Drag to reorder category"
                            onClick={(e) => e.stopPropagation()}
                            {...attributes}
                            {...listeners}
                          >
                            <GripVertical className="size-4" />
                          </button>
                          {expandedCat === c._id ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                          <span className="font-medium truncate">{c.title_en}</span>
                          <span className="text-slate-500 shrink-0">/ {c.title_ar}</span>
                        </div>
                        <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirm({ type: 'category', id: c._id, nameEn: c.title_en, nameAr: c.title_ar })} disabled={loading} aria-label={t('Delete category', 'حذف الفئة')}>
                            <Trash2 className="size-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                      {expandedCat === c._id && (
                        <div className="border-t border-slate-700/50 px-4 py-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium text-slate-500">
                              {t('Products', 'المنتجات')}
                              {(c.productSortMode ?? sortModes[c._id] ?? 'manual') === 'manual' && ' — ' + t('Drag to reorder or move', 'اسحب لإعادة الترتيب أو النقل')}
                            </p>
                            <select
                              value={c.productSortMode ?? sortModes[c._id] ?? 'manual'}
                              onChange={(e) => setSortModeForCategory(c._id, e.target.value as ProductSortMode)}
                              className="h-8 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                              title={t('Sort products by', 'ترتيب المنتجات حسب')}
                            >
                              <option value="manual">{t('Manual (drag & drop)', 'يدوياً (سحب وإفلات)')}</option>
                              <option value="name">{t('Name', 'الاسم')}</option>
                              <option value="price">{t('Price', 'السعر')}</option>
                            </select>
                          </div>
                          <DroppableProductList id={`drop-category-${c._id}`} isEmpty={getCategoryProducts(c._id).length === 0}>
                            {(c.productSortMode ?? sortModes[c._id] ?? 'manual') === 'manual' ? (
                              <SortableContext
                                items={getCategoryProducts(c._id).map((p) => `product-${p._id}`)}
                                strategy={verticalListSortingStrategy}
                              >
                                {getCategoryProducts(c._id).map((p) => (
                                  <SortableProduct
                                    key={`prod-${p._id}-${c._id}`}
                                    product={p}
                                    loading={loading || reorderingCategoryId === c._id}
                                    currentCategoryId={c._id}
                                    categories={categories}
                                    onEdit={() => openEditProduct(p)}
                                    onDuplicate={() => handleDuplicateProduct(p)}
                                    onDelete={() => setDeleteConfirm({ type: 'product', id: p._id, nameEn: p.title_en, nameAr: p.title_ar })}
                                    onMove={(targetId) => moveProductToCategory(p._id, targetId)}
                                  />
                                ))}
                              </SortableContext>
                            ) : (
                              getSortedCategoryProducts(c._id, (c.productSortMode ?? sortModes[c._id] ?? 'manual') as ProductSortMode).map((p) => (
                                <ProductRow
                                  key={`prod-${p._id}-${c._id}`}
                                  product={p}
                                  loading={loading}
                                  currentCategoryId={c._id}
                                  categories={categories}
                                  onEdit={() => openEditProduct(p)}
                                  onDuplicate={() => handleDuplicateProduct(p)}
                                  onDelete={() => setDeleteConfirm({ type: 'product', id: p._id, nameEn: p.title_en, nameAr: p.title_ar })}
                                  onMove={(targetId) => moveProductToCategory(p._id, targetId)}
                                />
                              ))
                            )}
                          </DroppableProductList>
                          <Button type="button" size="sm" className="mt-2 border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white" onClick={() => openAddProduct(c._id)}>
                            <Plus className="mr-1 size-3.5" /> Add product
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </SortableItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {addingCategory ? (
          <div className="mt-4 space-y-3">
            {!showCustomCategoryForm ? (
              <>
                <p className="text-xs text-slate-400">Pick a section. Suggested items match your business type.</p>
                <div className="space-y-4">
                  {sectionSuggestions && sectionSuggestions.subcategories.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-amber-200/90">Suggested for your business</p>
                      <div className="flex flex-wrap gap-2">
                        {sectionSuggestions.subcategories.map((s) => (
                          <button
                            key={s._id}
                            type="button"
                            onClick={() => addCategoryFromSuggestion(s.title_en, s.title_ar, s._id)}
                            disabled={submittingCategory}
                            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 transition-colors hover:border-amber-500/60 hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            {s.title_en} / {s.title_ar}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {sectionSuggestions && sectionSuggestions.commonSections.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-400">Other common sections</p>
                      <div className="flex flex-wrap gap-2">
                        {sectionSuggestions.commonSections.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => addCategoryFromSuggestion(s.title_en, s.title_ar)}
                            disabled={submittingCategory}
                            className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700/50 disabled:opacity-50"
                          >
                            {s.title_en} / {s.title_ar}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomCategoryForm(true)}
                      className="rounded-lg border border-dashed border-slate-500 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-300"
                    >
                      + Custom
                    </button>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingCategory(false)} disabled={submittingCategory}>Cancel</Button>
              </>
            ) : (
              <form onSubmit={handleAddCategory} className="flex flex-wrap gap-2">
                <Input name="title_en" placeholder="Category name (EN)" className="bg-slate-800 border-slate-600" required />
                <Input name="title_ar" placeholder="Category name (AR)" className="bg-slate-800 border-slate-600" required />
                <Button type="submit" size="sm" disabled={loading || submittingCategory}>
                  {submittingCategory ? 'Adding…' : 'Add'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCustomCategoryForm(false)} disabled={submittingCategory}>Back</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingCategory(false); setShowCustomCategoryForm(false) }} disabled={submittingCategory}>Cancel</Button>
              </form>
            )}
          </div>
        ) : (
          <Button type="button" size="sm" className="mt-4 bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={() => { setAddingCategory(true); setShowCustomCategoryForm(false) }}>
            <Plus className="mr-1.5 size-4" /> Add category
          </Button>
        )}
      </div>

      <ProductFormModal
        key={productModalOpen ? (productModalProduct?._id ?? 'new') : 'closed'}
        open={productModalOpen}
        onClose={() => { setProductModalOpen(false); setProductModalProduct(null) }}
        categories={categories}
        product={productModalProduct}
        defaultCategoryId={productModalCategoryId}
        onSave={handleSaveProduct}
        saving={savingProduct}
        slug={slug}
      />

      {canUseCatalog && (
        <CatalogProductsModal
          open={catalogOpen}
          onClose={() => setCatalogOpen(false)}
          categories={categories}
          slug={slug}
          businessType={businessType}
          onAdded={refreshMenu}
        />
      )}
    </div>
  )
}
