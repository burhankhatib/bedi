'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { Plus, Pencil, Trash2, Copy, ChevronDown, ChevronRight, GripVertical, AlertTriangle, Package, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { useTenantBusiness } from '../TenantBusinessContext'
import { CatalogProductsModal } from './CatalogProductsModal'
import { isAbortError } from '@/lib/abort-utils'
import { cn } from '@/lib/utils'
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
  dragTitle,
}: {
  product: { _id: string; title_en: string; price: number; currency: string }
  loading: boolean
  currentCategoryId: string
  categories: Array<{ _id: string; title_en: string }>
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (targetCategoryId: string) => void
  dragTitle?: string
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
          className="touch-none select-none flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-500/60 bg-slate-700/60 p-2.5 text-slate-400 hover:border-amber-500/50 hover:bg-slate-700 hover:text-amber-400 cursor-grab active:cursor-grabbing transition-colors"
          title={dragTitle ?? 'Drag to reorder or move'}
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

type Category = { _id: string; title_en: string; title_ar: string; slug: string; sortOrder?: number; productSortMode?: string; parentCategoryRef?: string }

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
  const canUseCatalog = true
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogDefaultCategoryId, setCatalogDefaultCategoryId] = useState<string | undefined>(undefined)
  const [catalogDefaultMenuCategoryTitle, setCatalogDefaultMenuCategoryTitle] = useState<string | undefined>(undefined)
  const [sortModes, setSortModes] = useState<Record<string, ProductSortMode>>(() => loadSortModes(slug))
  const [reorderingCategoryId, setReorderingCategoryId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'category' | 'product'
    id: string
    nameEn: string
    nameAr?: string
  } | null>(null)
  const [editingCategory, setEditingCategory] = useState<{ id: string; title_en: string; title_ar: string } | null>(null)
  const [savingCategory, setSavingCategory] = useState(false)

  const api = (path: string, options?: RequestInit & { refresh?: boolean }) => {
    const { refresh, ...rest } = options ?? {}
    const url = `/api/tenants/${slug}${path}${refresh ? '?refresh=1' : ''}`
    return fetch(url, { credentials: 'include', ...rest, headers: { 'Content-Type': 'application/json', ...rest.headers } })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reloadCategories = useCallback(async (forceRefresh = false) => {
    categoriesAbortRef.current?.abort()
    const ac = new AbortController()
    categoriesAbortRef.current = ac
    const requestId = ++latestCategoriesRequestRef.current
    try {
      const res = await api('/categories', { signal: ac.signal, refresh: forceRefresh })
      const data = await res.json()
      if (!mountedRef.current || ac.signal.aborted || latestCategoriesRequestRef.current !== requestId) return
      if (res.ok && Array.isArray(data)) setCategories(data)
    } catch (err) {
      if (isAbortError(err)) return
    }
  }, [slug])
  const reloadProducts = useCallback(async (forceRefresh = false) => {
    productsAbortRef.current?.abort()
    const ac = new AbortController()
    productsAbortRef.current = ac
    const requestId = ++latestProductsRequestRef.current
    try {
      const res = await api('/products', { signal: ac.signal, refresh: forceRefresh })
      const data = await res.json()
      if (!mountedRef.current || ac.signal.aborted || latestProductsRequestRef.current !== requestId) return
      if (res.ok && Array.isArray(data)) {
        const list: Product[] = data.map((p: Product & { categoryRef?: string }) => ({
          ...p,
          categoryId: p.categoryId ?? p.categoryRef ?? '',
        }))
        setProducts(list)
      }
    } catch (err) {
      if (isAbortError(err)) return
    }
  }, [slug])

  const refreshMenu = useCallback(() => {
    reloadCategories(false)
    reloadProducts(false)
  }, [reloadCategories, reloadProducts])

  const refreshMenuForce = useCallback(() => {
    reloadCategories(true)
    reloadProducts(true)
  }, [reloadCategories, reloadProducts])

  // Do not subscribe to Pusher menu-update on this page: it triggers a refetch that overwrites
  // local state with CDN-cached data (often stale). User edits stay until they click Refresh.
  // usePusherStream(siteId ? `tenant-${siteId}` : null, 'menu-update', refreshMenuDebounced)

  const [submittingCategory, setSubmittingCategory] = useState(false)
  const [sectionSuggestions, setSectionSuggestions] = useState<{
    businessType?: string
    commonSections: Array<{ title_en: string; title_ar: string }>
    subcategories: Array<{ _id: string; title_en: string; title_ar: string }>
    sectionGroups?: Array<{ key: string; title_en: string; title_ar: string; subCategories: Array<{ title_en: string; title_ar: string }> }>
  } | null>(null)
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(null)
  const [addingSubCategoryOf, setAddingSubCategoryOf] = useState<string | null>(null)
  const [addingSubCategoryOfSection, setAddingSubCategoryOfSection] = useState<string | null>(null)
  const [showCustomCategoryForm, setShowCustomCategoryForm] = useState(false)
  const mountedRef = useRef(false)
  const categoriesAbortRef = useRef<AbortController | null>(null)
  const productsAbortRef = useRef<AbortController | null>(null)
  const suggestionsAbortRef = useRef<AbortController | null>(null)
  const latestCategoriesRequestRef = useRef(0)
  const latestProductsRequestRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      categoriesAbortRef.current?.abort()
      productsAbortRef.current?.abort()
      suggestionsAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (addingCategory && !sectionSuggestions) {
      suggestionsAbortRef.current?.abort()
      const ac = new AbortController()
      suggestionsAbortRef.current = ac
      api('/menu-section-suggestions', { signal: ac.signal })
        .then((r) => r.json())
        .then((d) => {
          if (!mountedRef.current || ac.signal.aborted) return
          setSectionSuggestions({
            businessType: d.businessType,
            commonSections: d.commonSections ?? [],
            subcategories: d.subcategories ?? [],
            sectionGroups: d.sectionGroups ?? [],
          })
        })
        .catch((err) => {
          if (isAbortError(err)) return
          if (!mountedRef.current) return
          setSectionSuggestions({ commonSections: [], subcategories: [], sectionGroups: [] })
        })
    }
    return () => suggestionsAbortRef.current?.abort()
  }, [addingCategory, sectionSuggestions, slug])

  const findOrCreateParentForSection = useCallback(
    async (sectionKey: string): Promise<string | null> => {
      const group = sectionSuggestions?.sectionGroups?.find((g) => g.key === sectionKey)
      if (!group) return null
      const existing = categories.find((c) => c.title_en === group.title_en && !c.parentCategoryRef)
      if (existing) return existing._id
      const res = await api('/categories', { method: 'POST', body: JSON.stringify({ title_en: group.title_en, title_ar: group.title_ar }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !(data as { _id?: string })._id) return null
      const newId = (data as { _id?: string })._id ?? ''
      const newCat: Category = {
        _id: newId,
        title_en: group.title_en,
        title_ar: group.title_ar,
        slug: (data as { slug?: string }).slug ?? group.title_en.toLowerCase().replace(/\s+/g, '-'),
        sortOrder: (data as { sortOrder?: number }).sortOrder ?? 0,
      }
      setCategories((prev) => [...prev, newCat])
      setExpandedCat(newId)
      return newId
    },
    [api, categories, sectionSuggestions?.sectionGroups]
  )

  const addCategoryFromSuggestion = async (title_en: string, title_ar: string, subcategoryRef?: string, parentCategoryId?: string) => {
    if (submittingCategory) return
    setSubmittingCategory(true)
    try {
      let effectiveParentId = parentCategoryId
      const group = sectionSuggestions?.sectionGroups?.find((g) => g.key === selectedSectionKey)
      if (!effectiveParentId && selectedSectionKey && group && (title_en !== group.title_en || title_ar !== group.title_ar)) {
        effectiveParentId = (await findOrCreateParentForSection(selectedSectionKey)) ?? undefined
      }
      const body: Record<string, unknown> = { title_en, title_ar }
      if (subcategoryRef) body.subcategoryRef = subcategoryRef
      if (effectiveParentId) body.parentCategoryId = effectiveParentId
      const canOptimistic = !effectiveParentId || !effectiveParentId.startsWith('temp-')
      const tempId = canOptimistic ? `temp-cat-${Date.now()}` : ''
      const slugVal = (title_en || '').toLowerCase().replace(/\s+/g, '-')

      if (canOptimistic) {
        const optimisticCat: Category = {
          _id: tempId,
          title_en,
          title_ar,
          slug: slugVal,
          sortOrder: 0,
          ...(effectiveParentId && { parentCategoryRef: effectiveParentId }),
        }
        setCategories((prev) => [...prev, optimisticCat])
        setExpandedCat(tempId)
        setAddingCategory(false)
        setShowCustomCategoryForm(false)
        setSelectedSectionKey(null)
        setAddingSubCategoryOf(null)
        showToast('Category added.', 'تمت إضافة الفئة.', 'success')
      }

      const res = await api('/categories', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const realId = (data as { _id?: string })._id ?? ''
        const realSlug = (data as { slug?: string }).slug ?? slugVal
        if (canOptimistic) {
          setCategories((prev) =>
            prev.map((c) =>
              c._id === tempId
                ? { ...c, _id: realId, slug: realSlug, sortOrder: (data as { sortOrder?: number }).sortOrder ?? 0 }
                : c.parentCategoryRef === tempId
                  ? { ...c, parentCategoryRef: realId }
                  : c
            )
          )
          setProducts((prev) =>
            prev.map((p) => (p.categoryId === tempId ? { ...p, categoryId: realId } : p))
          )
          setExpandedCat(realId)
        } else {
          const newCat: Category = {
            _id: realId,
            title_en,
            title_ar,
            slug: realSlug,
            sortOrder: (data as { sortOrder?: number }).sortOrder ?? 0,
            ...(effectiveParentId && { parentCategoryRef: effectiveParentId }),
          }
          setCategories((prev) => [...prev, newCat])
          setExpandedCat(realId)
          setAddingCategory(false)
          setShowCustomCategoryForm(false)
          setSelectedSectionKey(null)
          setAddingSubCategoryOf(null)
          showToast('Category added.', 'تمت إضافة الفئة.', 'success')
        }
      } else {
        if (canOptimistic) setCategories((prev) => prev.filter((c) => c._id !== tempId))
        showToast((data as { error?: string })?.error || 'Failed to add category', 'فشل في إضافة الفئة.', 'error')
      }
    } finally {
      setSubmittingCategory(false)
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
    let parentId = addingSubCategoryOf || undefined
    if (!parentId && addingSubCategoryOfSection) {
      parentId = (await findOrCreateParentForSection(addingSubCategoryOfSection)) ?? undefined
    }
    const canOptimistic = !parentId || !parentId.startsWith('temp-')
    const tempId = canOptimistic ? `temp-cat-${Date.now()}` : ''
    const slugVal = (title_en || '').toLowerCase().replace(/\s+/g, '-')

    if (canOptimistic) {
      const optimisticCat: Category = {
        _id: tempId,
        title_en,
        title_ar,
        slug: slugVal,
        sortOrder: 0,
        ...(parentId && { parentCategoryRef: parentId }),
      }
      setCategories((prev) => [...prev, optimisticCat])
      setExpandedCat(tempId)
      setAddingCategory(false)
      setShowCustomCategoryForm(false)
      setAddingSubCategoryOf(null)
      setAddingSubCategoryOfSection(null)
      showToast('Category added.', 'تمت إضافة الفئة.', 'success')
    }

    try {
      const res = await api('/categories', { method: 'POST', body: JSON.stringify({ title_en, title_ar, parentCategoryId: parentId }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const realId = (data as { _id?: string })._id ?? ''
        const realSlug = (data as { slug?: string }).slug ?? slugVal
        if (canOptimistic) {
          setCategories((prev) =>
            prev.map((c) =>
              c._id === tempId
                ? { ...c, _id: realId, slug: realSlug, sortOrder: (data as { sortOrder?: number }).sortOrder ?? 0 }
                : c.parentCategoryRef === tempId
                  ? { ...c, parentCategoryRef: realId }
                  : c
            )
          )
          setProducts((prev) =>
            prev.map((p) => (p.categoryId === tempId ? { ...p, categoryId: realId } : p))
          )
          setExpandedCat(realId)
        } else {
          const newCat: Category = {
            _id: realId,
            title_en,
            title_ar,
            slug: realSlug,
            sortOrder: (data as { sortOrder?: number }).sortOrder ?? 0,
            ...(parentId && { parentCategoryRef: parentId }),
          }
          setCategories((prev) => [...prev, newCat])
          setExpandedCat(realId)
          setAddingCategory(false)
          setShowCustomCategoryForm(false)
          setAddingSubCategoryOf(null)
          setAddingSubCategoryOfSection(null)
          showToast('Category added.', 'تمت إضافة الفئة.', 'success')
        }
      } else {
        if (canOptimistic) setCategories((prev) => prev.filter((c) => c._id !== tempId))
        showToast((data as { error?: string })?.error || 'Failed to add category', 'فشل في إضافة الفئة.', 'error')
      }
    } finally {
      setSubmittingCategory(false)
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
    const body = buildProductBody(data)
    if (productModalProduct?._id) {
      const updated: Product = {
        ...productModalProduct,
        title_en: (body.title_en as string) ?? productModalProduct.title_en,
        title_ar: (body.title_ar as string) ?? productModalProduct.title_ar,
        description_en: (body.description_en as string | undefined) ?? productModalProduct.description_en,
        description_ar: (body.description_ar as string | undefined) ?? productModalProduct.description_ar,
        ingredients_en: (body.ingredients_en as string[] | undefined) ?? productModalProduct.ingredients_en,
        ingredients_ar: (body.ingredients_ar as string[] | undefined) ?? productModalProduct.ingredients_ar,
        price: (body.price as number) ?? productModalProduct.price,
        saleUnit: (body.saleUnit as string) ?? productModalProduct.saleUnit,
        specialPrice: (body.specialPrice as number | undefined) ?? productModalProduct.specialPrice,
        specialPriceExpires: (body.specialPriceExpires as string | undefined) ?? productModalProduct.specialPriceExpires,
        currency: (body.currency as string) ?? productModalProduct.currency,
        categoryId: (body.categoryId as string) ?? productModalProduct.categoryId,
        sortOrder: (body.sortOrder as number | undefined) ?? productModalProduct.sortOrder,
        isPopular: (body.isPopular as boolean) ?? productModalProduct.isPopular,
        isAvailable: body.isAvailable !== false,
        dietaryTags: (body.dietaryTags as string[] | undefined) ?? productModalProduct.dietaryTags,
        addOns: (body.addOns as Product['addOns']) ?? productModalProduct.addOns,
        variants: (body.variants as Product['variants']) ?? productModalProduct.variants,
      }
      setProducts((prev) =>
        prev.map((p) => (p._id === productModalProduct._id ? updated : p))
      )
      setProductModalOpen(false)
      setProductModalProduct(null)
      showToast('Product updated.', 'تم تحديث المنتج.', 'success')
      setSavingProduct(true)
      try {
        const res = await api(`/products/${productModalProduct._id}`, { method: 'PATCH', body: JSON.stringify(body) })
        const patched = await res.json().catch(() => null)
        if (!res.ok) {
          const msg = res.status === 403
            ? 'Session may have expired. Please sign in again.'
            : (patched as { error?: string })?.error || 'Failed to update product'
          showToast(msg, res.status === 403 ? 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' : 'فشل في تحديث المنتج.', 'error')
          reloadProducts(true)
          setProductModalProduct(updated)
          setProductModalOpen(true)
        }
      } finally {
        setSavingProduct(false)
      }
      return
    } else {
      setSavingProduct(true)
      try {
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
          setExpandedCat(categoryRef)
          showToast('Product added.', 'تمت إضافة المنتج.', 'success')
          setProductModalOpen(false)
          setProductModalProduct(null)
          // No reload: state already updated
        } else if (!res.ok) {
          const msg = res.status === 403
            ? 'Session may have expired. Please sign in again.'
            : (created as { error?: string })?.error || 'Failed to add product'
          showToast(msg, res.status === 403 ? 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' : 'فشل في إضافة المنتج.', 'error')
          setProductModalOpen(true)
          return
        }
      } finally {
        setSavingProduct(false)
      }
      setProductModalOpen(false)
      setProductModalProduct(null)
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

  const orderedCategoriesWithParent = useMemo(() => {
    const roots = categories.filter((c) => !c.parentCategoryRef).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const result: Array<{ category: Category; isSubCategory: boolean }> = []
    for (const r of roots) {
      result.push({ category: r, isSubCategory: false })
      const children = categories
        .filter((c) => c.parentCategoryRef === r._id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      for (const ch of children) {
        result.push({ category: ch, isSubCategory: true })
      }
    }
    return result
  }, [categories])

  useEffect(() => {
    if (orderedCategoriesWithParent.length > 0 && expandedCat === null) {
      const firstRoot = orderedCategoriesWithParent.find((e) => !e.isSubCategory)
      if (firstRoot) setExpandedCat(firstRoot.category._id)
    }
  }, [orderedCategoriesWithParent, expandedCat])

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

  const reparentCategory = useCallback(
    async (categoryId: string, newParentId: string) => {
      const moved = categories.find((c) => c._id === categoryId)
      const newParent = categories.find((c) => c._id === newParentId)
      if (!moved || !newParent || newParent.parentCategoryRef) return
      const siblings = categories.filter((c) => c.parentCategoryRef === newParentId)
      const newSortOrder = siblings.length > 0 ? Math.max(...siblings.map((c) => c.sortOrder ?? 0)) + SORT_ORDER_GAP : 0
      setCategories((prev) =>
        prev.map((c) =>
          c._id === categoryId ? { ...c, parentCategoryRef: newParentId, sortOrder: newSortOrder } : c
        )
      )
      setExpandedCat(newParentId)
      try {
        await api(`/categories/${categoryId}`, {
          method: 'PATCH',
          body: JSON.stringify({ parentCategoryId: newParentId, sortOrder: newSortOrder }),
        })
        showToast(t('Sub-category moved.', 'تم نقل الفئة الفرعية.'), '', 'success')
      } catch {
        showToast(t('Failed to move sub-category', 'فشل نقل الفئة الفرعية'), '', 'error')
        reloadCategories(true) // Rollback: refetch to restore correct state
      }
    },
    [categories, api, showToast, reloadCategories, t]
  )

  const reorderCategories = useCallback(async (fromIndex: number, toIndex: number) => {
    const ordered = orderedCategoriesWithParent
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= ordered.length) return
    const fromEntry = ordered[fromIndex]
    const toEntry = ordered[toIndex]
    const fromCat = fromEntry.category
    const toCat = toEntry.category
    const isReparenting =
      fromEntry.isSubCategory &&
      (toEntry.isSubCategory ? toCat.parentCategoryRef : toCat._id) !== fromCat.parentCategoryRef
    const newParentId = toEntry.isSubCategory ? (toCat.parentCategoryRef as string) : toCat._id

    if (isReparenting && newParentId && newParentId !== fromCat.parentCategoryRef) {
      await reparentCategory(fromCat._id, newParentId)
      return
    }

    const next = [...ordered]
    const [removed] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, removed)
    const updates = next.map((item, index) => ({ ...item.category, sortOrder: index }))
    setCategories((prev) => {
      const byId = new Map(prev.map((c) => [c._id, c]))
      return updates.map((u) => ({ ...(byId.get(u._id) ?? u), sortOrder: u.sortOrder }))
    })
    try {
      await Promise.all(updates.map((cat) => api(`/categories/${cat._id}`, { method: 'PATCH', body: JSON.stringify({ sortOrder: cat.sortOrder }) })))
      showToast(t('Category order updated.', 'تم تحديث ترتيب الفئات.'), '', 'success')
    } catch {
      showToast(t('Failed to save category order', 'فشل حفظ ترتيب الفئات'), '', 'error')
      reloadCategories(true) // Rollback on error
    }
  }, [orderedCategoriesWithParent, categories, api, showToast, reloadCategories, reparentCategory, t])

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
        reloadProducts(true) // Rollback on error
      }
    } catch {
      showToast('Failed to save order', 'فشل حفظ الترتيب', 'error')
      reloadProducts(true) // Rollback on error
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
          reloadProducts(true) // Rollback on error
        }
      } catch {
        showToast('Failed to move product', 'فشل نقل المنتج', 'error')
        reloadProducts(true) // Rollback on error
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
          const entry = orderedCategoriesWithParent[catIndex]
          if (!entry) return
          targetCategoryId = entry.category._id
        } else return
        moveProductToCategory(productId, targetCategoryId, insertAfterProductId)
      }
    },
    [reorderCategories, products, moveProductToCategory, orderedCategoriesWithParent]
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

  const onConfirmDelete = async () => {
    if (!deleteConfirm) return
    const { type, id } = deleteConfirm
    setDeleteConfirm(null)
    if (type === 'category') {
      const cat = categories.find((c) => c._id === id)
      if (!cat) return
      setCategories((prev) => prev.filter((c) => c._id !== id))
      setProducts((prev) => prev.filter((p) => p.categoryId !== id))
      try {
        const res = await api(`/categories/${id}`, { method: 'DELETE' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((data as { error?: string })?.error)
        showToast(t('Category deleted.', 'تم حذف الفئة.'), undefined, 'success')
      } catch {
        setCategories((prev) => [...prev, cat])
        setProducts((prev) => prev) // Products weren't actually filtered by deleted cat
        reloadCategories(true)
        reloadProducts(true)
        showToast(t('Could not delete category.', 'تعذر حذف الفئة.'), undefined, 'error')
      }
    } else {
      const product = products.find((p) => p._id === id)
      if (!product) return
      setProducts((prev) => prev.filter((p) => p._id !== id))
      try {
        const res = await api(`/products/${id}`, { method: 'DELETE' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((data as { error?: string })?.error)
        showToast(t('Product deleted.', 'تم حذف المنتج.'), undefined, 'success')
      } catch {
        setProducts((prev) => [...prev, product])
        reloadProducts(true)
        showToast(t('Could not delete product.', 'تعذر حذف المنتج.'), undefined, 'error')
      }
    }
  }

  const handleSaveCategoryEdit = useCallback(
    async (title_en: string, title_ar: string) => {
      if (!editingCategory || !title_en.trim() || !title_ar.trim()) return
      setSavingCategory(true)
      try {
        const res = await api(`/categories/${editingCategory.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title_en: title_en.trim(), title_ar: title_ar.trim() }),
        })
        if (res.ok) {
          setCategories((prev) =>
            prev.map((c) => (c._id === editingCategory.id ? { ...c, title_en: title_en.trim(), title_ar: title_ar.trim() } : c))
          )
          setEditingCategory(null)
          showToast(t('Category updated.', 'تم تحديث الفئة.'), '', 'success')
        } else {
          const data = await res.json().catch(() => ({}))
          showToast((data as { error?: string })?.error || t('Failed to update category.', 'فشل في تحديث الفئة.'), '', 'error')
        }
      } catch {
        showToast(t('Failed to update category.', 'فشل في تحديث الفئة.'), '', 'error')
      } finally {
        setSavingCategory(false)
      }
    },
    [editingCategory, api, showToast, t]
  )

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
      reloadCategories(true) // Rollback on error
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
      setProducts((prev) => [...prev, createdProduct])
      showToast('Product duplicated. You can edit the copy below.', 'تم نسخ المنتج. يمكنك تعديل النسخة أدناه.', 'success')
      openEditProduct(createdProduct)
      // No reload: state already updated
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Edit category dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent
          className="border-slate-700 bg-slate-900 text-white max-w-md"
          showCloseButton={true}
          overlayClassName="z-[100]"
          contentClassName="z-[100]"
        >
          <DialogHeader>
            <DialogTitle className="text-lg text-white">{t('Edit category', 'تعديل الفئة')}</DialogTitle>
            <DialogDescription className="text-slate-400 mt-1">
              {t('Update the category name in English and Arabic.', 'حدّث اسم الفئة بالإنجليزية والعربية.')}
            </DialogDescription>
          </DialogHeader>
          {editingCategory && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const en = (e.currentTarget.elements.namedItem('edit_title_en') as HTMLInputElement)?.value ?? ''
                const ar = (e.currentTarget.elements.namedItem('edit_title_ar') as HTMLInputElement)?.value ?? ''
                handleSaveCategoryEdit(en, ar)
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('English', 'الإنجليزية')}</label>
                <Input name="edit_title_en" defaultValue={editingCategory.title_en} className="bg-slate-800 border-slate-600 text-white" placeholder="Category name (EN)" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('Arabic', 'العربية')}</label>
                <Input name="edit_title_ar" defaultValue={editingCategory.title_ar} className="bg-slate-800 border-slate-600 text-white" placeholder="اسم الفئة (AR)" required dir="rtl" />
              </div>
              <DialogFooter className="gap-2 mt-5">
                <Button type="button" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800" onClick={() => setEditingCategory(null)} disabled={savingCategory}>
                  {t('Cancel', 'إلغاء')}
                </Button>
                <Button type="submit" className="bg-amber-500 text-slate-950 hover:bg-amber-400" disabled={savingCategory}>
                  {savingCategory ? t('Saving…', 'جاري الحفظ…') : t('Save', 'حفظ')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
            <h2 className="font-semibold text-white">{t('Categories', 'الفئات')}</h2>
            <p className="text-sm text-slate-400">
              {t('Drag categories to reorder or move sub-categories between main categories. Drag products to reorder or move between categories. Expand a category to access its products.', 'اسحب الفئات لإعادة الترتيب أو نقل الفئات الفرعية بين الفئات الرئيسية. اسحب المنتجات لإعادة الترتيب أو نقلها بين الفئات. وسّع الفئة للوصول إلى منتجاتها.')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => refreshMenuForce()}
              disabled={loading}
              title={t('Refresh data', 'تحديث البيانات')}
            >
              <RefreshCw className="mr-2 size-4" />
              {t('Refresh', 'تحديث')}
            </Button>
            {canUseCatalog && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:border-amber-500/70"
                onClick={() => { setCatalogDefaultCategoryId(undefined); setCatalogDefaultMenuCategoryTitle(undefined); setCatalogOpen(true) }}
              >
                <Package className="mr-2 size-4" />
                {t('Add from catalog', 'إضافة من الكتالوج')}
              </Button>
            )}
          </div>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedCategoriesWithParent.map((_, i) => `cat-${i}`)} strategy={verticalListSortingStrategy}>
            <ul className="mt-4 space-y-2">
              {orderedCategoriesWithParent.map(({ category: c, isSubCategory }, catIndex) => (
                <SortableItem key={`cat-${c._id}-${catIndex}`} id={`cat-${catIndex}`} className="rounded-lg border border-slate-700/50 bg-slate-800/30">
                  {({ attributes, listeners }) => (
                    <>
                      <div
                        className={cn(
                          "flex cursor-pointer items-center justify-between py-3",
                          isSubCategory ? "pl-8 pr-4 border-l-2 border-amber-500/30" : "px-4"
                        )}
                        onClick={() => setExpandedCat(expandedCat === c._id ? null : c._id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            className="touch-none select-none flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-500/60 bg-slate-700/60 p-2.5 text-slate-400 hover:border-amber-500/50 hover:bg-slate-700 hover:text-amber-400 cursor-grab active:cursor-grabbing transition-colors"
                            title={t("Drag to reorder or move category", "اسحب لإعادة الترتيب أو نقل الفئة")}
                            onClick={(e) => e.stopPropagation()}
                            {...attributes}
                            {...listeners}
                          >
                            <GripVertical className="size-5" />
                          </button>
                          {expandedCat === c._id ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                          <span className="font-medium truncate">{c.title_en}</span>
                          <span className="text-slate-500 shrink-0">/ {c.title_ar}</span>
                          {isSubCategory && <span className="text-xs text-slate-500">({t("sub", "فرعي")})</span>}
                        </div>
                        <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {expandedCat === c._id && (
                            <Button type="button" variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300" onClick={() => { setAddingCategory(true); setAddingSubCategoryOf(c._id); setShowCustomCategoryForm(false); setSelectedSectionKey(null) }} disabled={loading}>
                              + {t("Sub-category", "فئة فرعية")}
                            </Button>
                          )}
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-400" onClick={() => setEditingCategory({ id: c._id, title_en: c.title_en, title_ar: c.title_ar })} disabled={loading} aria-label={t("Edit category", "تعديل الفئة")} title={t("Edit category name", "تعديل اسم الفئة")}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirm({ type: "category", id: c._id, nameEn: c.title_en, nameAr: c.title_ar })} disabled={loading} aria-label={t("Delete category", "حذف الفئة")}>
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
                                    dragTitle={t('Drag to reorder or move to another category', 'اسحب لإعادة الترتيب أو نقل المنتج')}
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
                          {((isSubCategory) || !categories.some((cat) => cat.parentCategoryRef === c._id)) && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button type="button" size="sm" className="border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white" onClick={() => openAddProduct(c._id)}>
                                <Plus className="mr-1 size-3.5" /> Add product
                              </Button>
                              <Button type="button" size="sm" variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20" onClick={() => { setCatalogDefaultCategoryId(c._id); setCatalogDefaultMenuCategoryTitle(c.title_en); setCatalogOpen(true) }}>
                                <Package className="mr-1 size-3.5" /> {t('Global Catalog', 'الكتالوج العالمي')}
                              </Button>
                            </div>
                          )}
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
                {addingSubCategoryOf ? (
                  (() => {
                    const parentCat = categories.find((c) => c._id === addingSubCategoryOf)
                    const norm = (s: string) => (s ?? '').toLowerCase().trim().replace(/\s*&\s*/g, ' and ')
                    const matchingGroup = sectionSuggestions?.sectionGroups?.find(
                      (g) => parentCat && norm(g.title_en) === norm(parentCat.title_en)
                    )
                    return (
                      <div className="space-y-4">
                        <p className="text-xs text-amber-200/90">
                          {t('Add sub-category under', 'إضافة فئة فرعية تحت')}: <strong>{parentCat?.title_en ?? parentCat?.title_ar ?? ''}</strong>
                        </p>
                        {matchingGroup && matchingGroup.subCategories?.length > 0 ? (
                          <>
                            <p className="text-xs text-slate-400">{t('Suggested for this category', 'مقترحة لهذه الفئة')}:</p>
                            <div className="flex flex-wrap gap-2">
                              {matchingGroup.subCategories.map((s, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => addCategoryFromSuggestion(s.title_en, s.title_ar, undefined, addingSubCategoryOf)}
                                  disabled={submittingCategory}
                                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 transition-colors hover:border-amber-500/60 hover:bg-amber-500/20 disabled:opacity-50"
                                >
                                  {s.title_en} {s.title_ar ? `/ ${s.title_ar}` : ''}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500">{t('No predefined sub-categories for this category. Use Custom below.', 'لا توجد فئات فرعية محددة مسبقاً. استخدم مخصص أدناه.')}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCustomCategoryForm(true)}
                            className="rounded-lg border border-dashed border-slate-500 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-300"
                          >
                            + {t('Custom sub-category', 'فئة فرعية مخصصة')}
                          </button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingCategory(false); setAddingSubCategoryOf(null) }} disabled={submittingCategory}>
                            {t('Cancel', 'إلغاء')}
                          </Button>
                        </div>
                      </div>
                    )
                  })()
                ) : sectionSuggestions && (sectionSuggestions.sectionGroups?.length ?? 0) > 0 ? (
                  <>
                    <p className="text-xs text-slate-400">{t('Pick a section. Suggested items match your business type.', 'اختر قسم. العناصر المقترحة تطابق نوع عملك.')}</p>
                    <div className="space-y-4">
                      {selectedSectionKey ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => { setSelectedSectionKey(null); setAddingSubCategoryOfSection(null) }}
                          className="mb-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300"
                        >
                          <ChevronRight className="size-3.5 rotate-180" /> Back
                        </button>
                        {(() => {
                          const group = sectionSuggestions.sectionGroups?.find((g) => g.key === selectedSectionKey)
                          return (
                            <>
                              <p className="mb-2 text-xs font-medium text-amber-200/90">
                                {group?.title_en} / {group?.title_ar}
                              </p>
                              <div className="mb-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => addCategoryFromSuggestion(group!.title_en, group!.title_ar)}
                                  disabled={submittingCategory}
                                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/20 disabled:opacity-50"
                                >
                                  + {t('Add as main category', 'إضافة كفئة رئيسية')}: {group?.title_en}
                                </button>
                              </div>
                              <p className="mb-2 text-xs text-slate-400">{t('Or add sub-categories', 'أو أضف فئات فرعية')}:</p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setShowCustomCategoryForm(true); setAddingSubCategoryOfSection(selectedSectionKey) }}
                                  className="rounded-lg border border-dashed border-slate-500 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-300"
                                >
                                  + {t('Custom sub-category', 'فئة فرعية مخصصة')}
                                </button>
                                {group?.subCategories.map((s, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => addCategoryFromSuggestion(s.title_en, s.title_ar)}
                                    disabled={submittingCategory}
                                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 transition-colors hover:border-amber-500/60 hover:bg-amber-500/20 disabled:opacity-50"
                                  >
                                    {s.title_en} / {s.title_ar}
                                  </button>
                                ))}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    ) : (
                      <div>
                        <p className="mb-2 text-xs font-medium text-amber-200/90">Select a category</p>
                        <div className="flex flex-wrap gap-2">
                          {sectionSuggestions.sectionGroups?.map((g) => (
                            <button
                              key={g.key}
                              type="button"
                              onClick={() => setSelectedSectionKey(g.key)}
                              disabled={submittingCategory}
                              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 transition-colors hover:border-amber-500/60 hover:bg-amber-500/20 disabled:opacity-50"
                            >
                              {g.title_en} / {g.title_ar}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                    <>
                      {sectionSuggestions && sectionSuggestions.subcategories.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium text-amber-200/90">Suggested for your business</p>
                          <div className="flex flex-wrap gap-2">
                            {sectionSuggestions.subcategories.map((s) => (
                              <button
                                key={s._id}
                                type="button"
                                onClick={() => addCategoryFromSuggestion(s.title_en, s.title_ar, s._id, addingSubCategoryOf ?? undefined)}
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
                                onClick={() => addCategoryFromSuggestion(s.title_en, s.title_ar, undefined, addingSubCategoryOf ?? undefined)}
                                disabled={submittingCategory}
                                className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700/50 disabled:opacity-50"
                              >
                                {s.title_en} / {s.title_ar}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => { setShowCustomCategoryForm(true); setSelectedSectionKey(null); setAddingSubCategoryOf(null); setAddingSubCategoryOfSection(null) }}
                    className="rounded-lg border border-dashed border-slate-500 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-300"
                  >
                    + {t('Custom', 'مخصص')}
                  </button>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingCategory(false); setSelectedSectionKey(null); setAddingSubCategoryOf(null); setAddingSubCategoryOfSection(null) }} disabled={submittingCategory}>Cancel</Button>
              </>
            ) : (
              <form onSubmit={handleAddCategory} className="flex flex-wrap gap-2">
                {(addingSubCategoryOf || addingSubCategoryOfSection) && (
                  <p className="w-full text-xs text-amber-200/90">
                    {t('Adding sub-category under', 'إضافة فئة فرعية تحت')}:{' '}
                    {addingSubCategoryOf
                      ? categories.find((c) => c._id === addingSubCategoryOf)?.title_en ?? ''
                      : sectionSuggestions?.sectionGroups?.find((g) => g.key === addingSubCategoryOfSection)?.title_en ?? ''}
                  </p>
                )}
                <Input name="title_en" placeholder="Category name (EN)" className="bg-slate-800 border-slate-600" required />
                <Input name="title_ar" placeholder="Category name (AR)" className="bg-slate-800 border-slate-600" required />
                <Button type="submit" size="sm" disabled={loading || submittingCategory}>
                  {submittingCategory ? 'Adding…' : 'Add'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCustomCategoryForm(false); setAddingSubCategoryOf(null); setAddingSubCategoryOfSection(null) }} disabled={submittingCategory}>Back</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingCategory(false); setShowCustomCategoryForm(false) }} disabled={submittingCategory}>Cancel</Button>
              </form>
            )}
          </div>
        ) : (
          <Button type="button" size="sm" className="mt-4 bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={() => { setAddingCategory(true); setShowCustomCategoryForm(false); setSelectedSectionKey(null) }}>
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
          onClose={() => { setCatalogOpen(false); setCatalogDefaultCategoryId(undefined); setCatalogDefaultMenuCategoryTitle(undefined) }}
          categories={categories}
          slug={slug}
          businessType={businessType || 'grocery'}
          defaultCategoryId={catalogDefaultCategoryId}
          defaultMenuCategoryTitle={catalogDefaultMenuCategoryTitle}
          onAdded={refreshMenuForce}
        />
      )}
    </div>
  )
}
