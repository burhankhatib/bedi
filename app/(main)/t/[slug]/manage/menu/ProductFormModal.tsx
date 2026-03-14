'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { urlFor } from '@/sanity/lib/image'
import { compressImageForUpload } from '@/lib/compress-image'
import { SALE_UNITS } from '@/lib/sale-units'
import { Plus, Trash2, Upload, ImageIcon, GripVertical } from 'lucide-react'

/** Max image upload size (4 MB). Server/platform may enforce lower (e.g. 4.5 MB on Vercel). */
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024
const MAX_IMAGE_SIZE_MB = 4
const UPLOAD_SIZE_ERROR = `Image is too large. Maximum size is ${MAX_IMAGE_SIZE_MB} MB. Use a smaller image or compress it (e.g. JPEG at 80% quality).`

export type ProductVariantOption = {
  label_en: string
  label_ar: string
  priceModifier?: number
  specialPriceModifier?: number
  specialPriceModifierExpires?: string
  /** Sanity image asset id for option image (form state); sent as option.image in API. */
  imageAssetId?: string
  /** When true, this option is pre-selected when the customer opens the product. One per group. */
  isDefault?: boolean
}
export type ProductVariantGroup = { name_en: string; name_ar: string; required?: boolean; options: ProductVariantOption[] }

export type ProductFormData = {
  title_en: string
  title_ar: string
  description_en: string
  description_ar: string
  ingredients_en: string[]
  ingredients_ar: string[]
  price: number
  saleUnit: string
  specialPrice: number | ''
  specialPriceExpires: string
  currency: string
  categoryId: string
  sortOrder: number
  isPopular: boolean
  isAvailable: boolean
  availableAgainAt: string
  dietaryTags: string[]
  addOns: Array<{ name_en: string; name_ar: string; price: number }>
  variants: ProductVariantGroup[]
  imageUrl: string
  additionalImageUrls: string[]
  imageAssetId?: string
  additionalImageAssetIds?: string[]
  /** When true and product has catalogRef, new image is added to catalog for other tenants. */
  contributeImageToCatalog?: boolean
}

const DIETARY_OPTIONS = [
  { value: 'vegan', label: 'Vegan' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'spicy', label: 'Spicy' },
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'nuts', label: 'Contains Nuts' },
  { value: 'halal', label: 'Halal' },
]

const defaultForm: ProductFormData = {
  title_en: '',
  title_ar: '',
  description_en: '',
  description_ar: '',
  ingredients_en: [],
  ingredients_ar: [],
  price: 0,
  saleUnit: 'piece',
  specialPrice: '',
  specialPriceExpires: '',
  currency: 'ILS',
  categoryId: '',
  sortOrder: 0,
  isPopular: false,
  isAvailable: true,
  availableAgainAt: '',
  dietaryTags: [],
  addOns: [],
  variants: [],
  imageUrl: '',
  additionalImageUrls: [],
}

type Category = { _id: string; title_en: string; title_ar: string }
/** Accepts full form data or API product shape (e.g. without imageUrl/additionalImageUrls); modal normalizes with ?? */
type ProductProp = (Partial<ProductFormData> & { _id?: string; catalogRef?: string }) | null

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

export function ProductFormModal({
  open,
  onClose,
  categories,
  product,
  defaultCategoryId,
  onSave,
  saving,
  slug,
}: {
  open: boolean
  onClose: () => void
  categories: Category[]
  product: ProductProp
  defaultCategoryId?: string
  onSave: (data: ProductFormData) => Promise<void>
  saving: boolean
  slug: string
}) {
  const [form, setForm] = useState<ProductFormData>(defaultForm)
  const [ingredientsEnText, setIngredientsEnText] = useState('')
  const [ingredientsArText, setIngredientsArText] = useState('')
  const [additionalImagesText, setAdditionalImagesText] = useState('')
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null)
  const [mainImageUploading, setMainImageUploading] = useState(false)
  const [additionalPreviews, setAdditionalPreviews] = useState<Array<{ id: string; url: string; assetId?: string }>>([])
  const [additionalUploading, setAdditionalUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [suggestionGroups, setSuggestionGroups] = useState<ProductVariantGroup[]>([])
  const [suggestionAddOns, setSuggestionAddOns] = useState<Array<{ name_en: string; name_ar: string; price: number }>>([])
  const mainInputRef = useRef<HTMLInputElement>(null)
  const additionalInputRef = useRef<HTMLInputElement>(null)
  const variantOptionImageInputRef = useRef<HTMLInputElement>(null)
  const [pendingVariantImageUpload, setPendingVariantImageUpload] = useState<{ gi: number; oi: number } | null>(null)
  const lastOpenRef = useRef(false)
  const lastProductIdRef = useRef<string | null>(null)
  const productRef = useRef(product)
  productRef.current = product

  useEffect(() => {
    if (!open || !slug) return
    fetch(`/api/tenants/${slug}/menu/suggestions`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { variantGroups?: ProductVariantGroup[]; addOns?: Array<{ name_en: string; name_ar: string; price: number }> }) => {
        setSuggestionGroups(Array.isArray(data.variantGroups) ? data.variantGroups : [])
        setSuggestionAddOns(Array.isArray(data.addOns) ? data.addOns : [])
      })
      .catch(() => {})
  }, [open, slug])

  // Sync form from product when modal opens or when switching product. Use productRef so we read latest.
  useEffect(() => {
    if (!open) {
      lastOpenRef.current = false
      return
    }
    const p = productRef.current
    const productId = p?._id ?? null
    const shouldSync = !lastOpenRef.current || productId !== lastProductIdRef.current
    lastOpenRef.current = true
    lastProductIdRef.current = productId

    if (!shouldSync) return

    setUploadError(null)
    if (p) {
      const rawImage = (p as { image?: { asset?: { _ref?: string } } }).image
      const imageRef = rawImage?.asset?._ref
      const mainPreviewUrl = imageRef
        ? urlFor({ _type: 'image', asset: { _type: 'reference', _ref: imageRef } }).width(320).height(320).url()
        : null
      setMainImagePreview(mainPreviewUrl)

      const additionalImages = (p as { additionalImages?: Array<{ asset?: { _ref?: string } }> }).additionalImages ?? []
      const additionalImageAssetIds = additionalImages
        .map((img) => img?.asset?._ref)
        .filter((ref): ref is string => typeof ref === 'string' && ref.length > 0)
      const previewsFromExisting = additionalImages
        .map((img) => {
          const ref = img?.asset?._ref
          if (!ref) return null
          try {
            const url = urlFor({ _type: 'image', asset: { _type: 'reference', _ref: ref } }).width(160).height(160).url()
            return { id: ref, url, assetId: ref }
          } catch {
            return { id: ref, url: '', assetId: ref }
          }
        })
        .filter((p): p is { id: string; url: string; assetId: string } => p != null && typeof p.id === 'string')

      const rawVariants = (p as { variants?: unknown }).variants
      const variantsArray = Array.isArray(rawVariants) ? rawVariants : []
      const categoryId =
        (p as { categoryId?: string }).categoryId ??
        (p as { categoryRef?: string }).categoryRef ??
        (typeof (p as { category?: { _ref?: string } }).category?._ref === 'string' ? (p as { category: { _ref: string } }).category._ref : '') ??
        ''

      setForm({
        title_en: p.title_en ?? '',
        title_ar: p.title_ar ?? '',
        description_en: p.description_en ?? '',
        description_ar: p.description_ar ?? '',
        ingredients_en: p.ingredients_en ?? [],
        ingredients_ar: p.ingredients_ar ?? [],
        price: p.price ?? 0,
        saleUnit: (p as { saleUnit?: string }).saleUnit ?? 'piece',
        specialPrice: (p.specialPrice ?? '') as number | '',
        specialPriceExpires: p.specialPriceExpires ? String(p.specialPriceExpires).slice(0, 16) : '',
        currency: p.currency ?? 'ILS',
        categoryId,
        sortOrder: p.sortOrder ?? 0,
        isPopular: p.isPopular ?? false,
        isAvailable: p.isAvailable !== false,
        availableAgainAt: p.availableAgainAt ? String(p.availableAgainAt).slice(0, 16) : '',
        dietaryTags: p.dietaryTags ?? [],
        addOns: p.addOns ?? [],
        imageUrl: (p as { imageUrl?: string }).imageUrl ?? '',
        additionalImageUrls: (p as { additionalImageUrls?: string[] }).additionalImageUrls ?? [],
        imageAssetId: (p as { imageAssetId?: string }).imageAssetId ?? imageRef ?? undefined,
        additionalImageAssetIds: additionalImageAssetIds.length > 0 ? additionalImageAssetIds : undefined,
        contributeImageToCatalog: (p as { catalogRef?: string }).catalogRef ? true : false,
        variants: variantsArray.map((g: Record<string, unknown>) => ({
          name_en: (g.name_en as string) ?? '',
          name_ar: (g.name_ar as string) ?? '',
          required: (g.required as boolean) ?? false,
          options: (Array.isArray(g.options) ? g.options : []).map((o: Record<string, unknown>) => ({
            label_en: (o.label_en as string) ?? '',
            label_ar: (o.label_ar as string) ?? '',
            priceModifier: typeof o.priceModifier === 'number' ? o.priceModifier : 0,
            specialPriceModifier: typeof o.specialPriceModifier === 'number' ? o.specialPriceModifier : undefined,
            specialPriceModifierExpires: (o.specialPriceModifierExpires as string) ?? undefined,
            imageAssetId: ((o as { image?: { asset?: { _ref?: string } } }).image?.asset?._ref) ?? undefined,
            isDefault: (o.isDefault as boolean) ?? false,
          })),
        })),
      })
      setIngredientsEnText((p.ingredients_en ?? []).join('\n'))
      setIngredientsArText((p.ingredients_ar ?? []).join('\n'))
      setAdditionalImagesText(((p as { additionalImageUrls?: string[] }).additionalImageUrls ?? []).join('\n'))
      setAdditionalPreviews(previewsFromExisting)
    } else {
      setMainImagePreview(null)
      setAdditionalPreviews([])
      setForm({ ...defaultForm, saleUnit: 'piece', categoryId: defaultCategoryId ?? (categories[0]?._id ?? '') })
      setIngredientsEnText('')
      setIngredientsArText('')
      setAdditionalImagesText('')
    }
    // Intentionally omit `product` and `categories` so live refresh doesn't reset form and wipe user input
  }, [open, product?._id, defaultCategoryId])

  const update = (key: keyof ProductFormData, value: unknown) => setForm((f) => ({ ...f, [key]: value }))

  const setPresetAvailableAt = (hour: number, min: number, dayOffset = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + dayOffset)
    d.setHours(hour, min, 0, 0)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    update('availableAgainAt', `${y}-${m}-${day}T${h}:${mi}`)
  }

  const toggleDietary = (value: string) => {
    setForm((f) => ({
      ...f,
      dietaryTags: f.dietaryTags.includes(value) ? f.dietaryTags.filter((t) => t !== value) : [...f.dietaryTags, value],
    }))
  }

  const addAddOn = () => setForm((f) => ({ ...f, addOns: [...f.addOns, { name_en: '', name_ar: '', price: 0 }] }))
  const removeAddOn = (i: number) => setForm((f) => ({ ...f, addOns: f.addOns.filter((_, idx) => idx !== i) }))
  const updateAddOn = (i: number, field: 'name_en' | 'name_ar' | 'price', value: string | number) => {
    setForm((f) => ({
      ...f,
      addOns: f.addOns.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    }))
  }
  const reorderAddOns = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setForm((f) => {
      const next = [...f.addOns]
      const [removed] = next.splice(fromIndex, 1)
      const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex
      next.splice(insertAt, 0, removed)
      return { ...f, addOns: next }
    })
  }

  const addVariantGroup = () =>
    setForm((f) => ({ ...f, variants: [...f.variants, { name_en: '', name_ar: '', required: false, options: [{ label_en: '', label_ar: '', priceModifier: 0 }] }] }))
  const addVariantFromSuggestion = (group: ProductVariantGroup) => {
    setForm((f) => ({
      ...f,
      variants: [
        ...f.variants,
        {
          name_en: group.name_en || '',
          name_ar: group.name_ar || '',
          required: group.required ?? false,
          options: (group.options || []).map((o) => ({
            label_en: o.label_en ?? '',
            label_ar: o.label_ar ?? '',
            priceModifier: typeof o.priceModifier === 'number' ? o.priceModifier : 0,
            specialPriceModifier: o.specialPriceModifier,
            specialPriceModifierExpires: o.specialPriceModifierExpires ?? '',
            imageAssetId: (o as { image?: { asset?: { _ref?: string } } }).image?.asset?._ref ?? o.imageAssetId,
            isDefault: (o as { isDefault?: boolean }).isDefault ?? false,
          })),
        },
      ],
    }))
  }
  const addAddOnFromSuggestion = (addon: { name_en: string; name_ar: string; price: number }) => {
    setForm((f) => ({ ...f, addOns: [...f.addOns, { name_en: addon.name_en, name_ar: addon.name_ar, price: addon.price }] }))
  }
  const removeVariantGroup = (gi: number) =>
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== gi) }))
  const addVariantOption = (gi: number) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((g, i) =>
        i === gi ? { ...g, options: [...g.options, { label_en: '', label_ar: '', priceModifier: 0, isDefault: false }] } : g
      ),
    }))
  type VariantOptionField = 'label_en' | 'label_ar' | 'priceModifier' | 'specialPriceModifier' | 'specialPriceModifierExpires' | 'imageAssetId' | 'isDefault'
  const removeVariantOption = (gi: number, oi: number) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((g, i) =>
        i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g
      ),
    }))
  const updateVariantGroup = (gi: number, field: 'name_en' | 'name_ar' | 'required', value: string | boolean) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((g, i) => (i === gi ? { ...g, [field]: value } : g)),
    }))
  const setVariantOptionDefault = (gi: number, oi: number | null) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((g, i) =>
        i === gi
          ? { ...g, options: g.options.map((o, j) => ({ ...o, isDefault: oi !== null && j === oi })) }
          : g
      ),
    }))
  }
  const updateVariantOption = (gi: number, oi: number, field: VariantOptionField, value: string | number | undefined) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((g, i) =>
        i === gi
          ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, [field]: value } : o)) }
          : g
      ),
    }))
  const reorderVariantGroups = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setForm((f) => {
      const next = [...f.variants]
      const [removed] = next.splice(fromIndex, 1)
      const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex
      next.splice(insertAt, 0, removed)
      return { ...f, variants: next }
    })
  }
  const reorderVariantOptions = (gi: number, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setForm((f) => ({
      ...f,
      variants: f.variants.map((g, i) => {
        if (i !== gi) return g
        const next = [...g.options]
        const [removed] = next.splice(fromIndex, 1)
        const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex
        next.splice(insertAt, 0, removed)
        return { ...g, options: next }
      }),
    }))
  }
  const handleAddOnsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = parseInt(String(active.id).replace('addon-', ''), 10)
    const to = parseInt(String(over.id).replace('addon-', ''), 10)
    if (Number.isNaN(from) || Number.isNaN(to)) return
    reorderAddOns(from, to)
  }
  const handleVariantGroupsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = parseInt(String(active.id).replace('vg-', ''), 10)
    const to = parseInt(String(over.id).replace('vg-', ''), 10)
    if (Number.isNaN(from) || Number.isNaN(to)) return
    reorderVariantGroups(from, to)
  }
  const handleVariantOptionsDragEnd = (gi: number) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const prefix = `vo-${gi}-`
    const from = parseInt(String(active.id).replace(prefix, ''), 10)
    const to = parseInt(String(over.id).replace(prefix, ''), 10)
    if (Number.isNaN(from) || Number.isNaN(to)) return
    reorderVariantOptions(gi, from, to)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const uploadMainImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (JPEG, PNG, WebP or GIF).')
      return
    }
    setUploadError(null)
    setMainImageUploading(true)
    try {
      const compressed = await compressImageForUpload(file)
      if (compressed.size > MAX_IMAGE_SIZE_BYTES) {
        setUploadError(UPLOAD_SIZE_ERROR)
        return
      }
      const fd = new FormData()
      fd.append('file', compressed)
      const res = await fetch(`/api/tenants/${slug}/upload`, { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          res.status === 413
            ? UPLOAD_SIZE_ERROR
            : typeof data?.error === 'string'
              ? data.error
              : `Upload failed (${res.status}). ${res.status === 413 ? 'File too large.' : ''}`
        setUploadError(msg)
        setMainImagePreview(null)
        return
      }
      const _id = data?._id
      if (!_id) {
        setUploadError('Upload failed: no image ID returned.')
        setMainImagePreview(null)
        return
      }
      setForm((f) => ({ ...f, imageAssetId: _id, imageUrl: '' }))
      setMainImagePreview(URL.createObjectURL(compressed))
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
      setMainImagePreview(null)
    } finally {
      setMainImageUploading(false)
      if (mainInputRef.current) mainInputRef.current.value = ''
    }
  }

  const uploadAdditionalImages = async (files: FileList | null) => {
    if (!files?.length) return
    setUploadError(null)
    setAdditionalUploading(true)
    try {
      const newPreviews: Array<{ id: string; url: string; assetId?: string }> = []
      const newIds: string[] = []
      let lastError: string | null = null
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue
        const compressed = await compressImageForUpload(file)
        if (compressed.size > MAX_IMAGE_SIZE_BYTES) {
          lastError = UPLOAD_SIZE_ERROR
          continue
        }
        const fd = new FormData()
        fd.append('file', compressed)
        const res = await fetch(`/api/tenants/${slug}/upload`, { method: 'POST', body: fd, credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          lastError = res.status === 413 ? UPLOAD_SIZE_ERROR : (typeof data?.error === 'string' ? data.error : `Upload failed (${res.status})`)
          continue
        }
        const _id = data?._id
        if (!_id) continue
        newPreviews.push({ id: _id, url: URL.createObjectURL(compressed), assetId: _id })
        newIds.push(_id)
      }
      if (lastError && newIds.length === 0) setUploadError(lastError)
      if (newIds.length > 0) {
        setAdditionalPreviews((prev) => [...prev, ...newPreviews])
        setForm((f) => ({ ...f, additionalImageAssetIds: [...(f.additionalImageAssetIds ?? []), ...newIds], additionalImageUrls: [] }))
        setAdditionalImagesText('')
      }
    } finally {
      setAdditionalUploading(false)
      if (additionalInputRef.current) additionalInputRef.current.value = ''
    }
  }

  const removeAdditionalImage = (index: number) => {
    const prev = additionalPreviews[index]
    if (prev?.url) URL.revokeObjectURL(prev.url)
    setAdditionalPreviews((p) => p.filter((_, i) => i !== index))
    setForm((f) => {
      const ids = f.additionalImageAssetIds ?? []
      return { ...f, additionalImageAssetIds: ids.filter((_, i) => i !== index) }
    })
  }

  const uploadVariantOptionImage = async (gi: number, oi: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file.')
      return
    }
    setUploadError(null)
    try {
      const compressed = await compressImageForUpload(file)
      if (compressed.size > MAX_IMAGE_SIZE_BYTES) {
        setUploadError(UPLOAD_SIZE_ERROR)
        return
      }
      const fd = new FormData()
      fd.append('file', compressed)
      const res = await fetch(`/api/tenants/${slug}/upload`, { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setUploadError(typeof data?.error === 'string' ? data.error : `Upload failed (${res.status})`)
        return
      }
      const _id = data?._id
      if (_id) updateVariantOption(gi, oi, 'imageAssetId', _id)
    } finally {
      setPendingVariantImageUpload(null)
      if (variantOptionImageInputRef.current) variantOptionImageInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ingredients_en = ingredientsEnText.trim() ? ingredientsEnText.split('\n').map((s) => s.trim()).filter(Boolean) : []
    const ingredients_ar = ingredientsArText.trim() ? ingredientsArText.split('\n').map((s) => s.trim()).filter(Boolean) : []
    const additionalImageUrls = !form.additionalImageAssetIds?.length && additionalImagesText.trim()
      ? additionalImagesText.split('\n').map((s) => s.trim()).filter(Boolean)
      : []
    const payload: ProductFormData = {
      ...form,
      ingredients_en,
      ingredients_ar,
      additionalImageUrls,
      specialPrice: form.specialPrice === '' ? ('' as const) : Number(form.specialPrice),
      specialPriceExpires: form.specialPriceExpires || '',
      availableAgainAt: form.availableAgainAt || '',
      imageAssetId: form.imageAssetId || undefined,
      additionalImageAssetIds: Array.isArray(form.additionalImageAssetIds) ? form.additionalImageAssetIds : [],
    }
    await onSave(payload)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md flex flex-col gap-0 p-0 border-slate-700 bg-slate-900 text-white"
        showCloseButton={true}
      >
        <DialogHeader className="shrink-0 border-b border-slate-700/60 px-4 py-3">
          <DialogTitle className="text-base font-semibold">
            {product ? 'Edit product' : 'Add product'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {/* Availability — on top for quick access (M3 style) */}
              <div className="rounded-2xl border border-slate-600/80 bg-slate-800/60 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Availability
                </h3>
                <p className="text-xs text-slate-500">Mark unavailable when sold out (e.g. ran out of chicken tenders). Product will show as grayed out until it&apos;s back.</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isAvailable}
                    onChange={async (e) => {
                      const checked = e.target.checked
                      if (checked) {
                        setForm((f) => ({ ...f, isAvailable: true, availableAgainAt: '' }))
                      } else {
                        setForm((f) => ({ ...f, isAvailable: false }))
                        try {
                          const res = await fetch(`/api/tenants/${slug}/next-opening`, { credentials: 'include' })
                          const data = await res.json()
                          if (data?.nextOpenAt) {
                            setForm((f) => ({ ...f, availableAgainAt: new Date(data.nextOpenAt).toISOString().slice(0, 16) }))
                          } else {
                            setPresetAvailableAt(9, 0, 1)
                          }
                        } catch {
                          setPresetAvailableAt(9, 0, 1)
                        }
                      }
                    }}
                    className="rounded border-slate-600 bg-slate-800 size-5 accent-amber-500"
                  />
                  <span className="text-sm font-medium text-slate-200">Available</span>
                </label>
                {!form.isAvailable && (
                  <div className="space-y-3 pt-2 border-t border-slate-600/60">
                    <p className="text-xs font-medium text-slate-400">Available again:</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date()
                          d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0)
                          const y = d.getFullYear()
                          const m = String(d.getMonth() + 1).padStart(2, '0')
                          const day = String(d.getDate()).padStart(2, '0')
                          const h = String(d.getHours()).padStart(2, '0')
                          const mi = String(d.getMinutes()).padStart(2, '0')
                          update('availableAgainAt', `${y}-${m}-${day}T${h}:${mi}`)
                        }}
                        className="rounded-xl px-4 py-2.5 text-sm font-medium bg-slate-700/80 hover:bg-slate-600 border border-slate-600 text-slate-200 transition-colors"
                      >
                        1 hour
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/tenants/${slug}/next-opening`, { credentials: 'include' })
                            const data = await res.json()
                            if (data?.nextOpenAt) {
                              update('availableAgainAt', new Date(data.nextOpenAt).toISOString().slice(0, 16))
                            }
                          } catch {
                            setPresetAvailableAt(9, 0, 1)
                          }
                        }}
                        className="rounded-xl px-4 py-2.5 text-sm font-medium bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 transition-colors"
                      >
                        Until next opening
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!form.availableAgainAt) setPresetAvailableAt(9, 0, 1)
                        }}
                        className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors ${form.availableAgainAt ? 'bg-slate-700/80 border-slate-600 text-slate-200' : 'bg-amber-500/20 border-amber-500/50 text-amber-200'}`}
                      >
                        Custom date & time
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-500">Date & time (leave empty = until next opening)</label>
                      <Input
                        type="datetime-local"
                        value={form.availableAgainAt}
                        onChange={(e) => update('availableAgainAt', e.target.value)}
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                      <div className="flex flex-wrap gap-2 pt-1">
                        {[
                          { label: 'Today 18:00', fn: () => setPresetAvailableAt(18, 0) },
                          { label: 'Today 21:00', fn: () => setPresetAvailableAt(21, 0) },
                          { label: 'Tomorrow 09:00', fn: () => setPresetAvailableAt(9, 0, 1) },
                          { label: 'Tomorrow 12:00', fn: () => setPresetAvailableAt(12, 0, 1) },
                        ].map(({ label, fn }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={fn}
                            className="rounded-lg border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-[11px] text-slate-400 hover:bg-slate-600/50 hover:text-slate-300 transition-colors"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Title (English) *</label>
                <Input
                  value={form.title_en}
                  onChange={(e) => update('title_en', e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Title (Arabic) *</label>
                <Input
                  dir="rtl"
                  value={form.title_ar}
                  onChange={(e) => update('title_ar', e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white text-right"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Description (EN)</label>
                <textarea
                  value={form.description_en}
                  onChange={(e) => update('description_en', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Description (AR)</label>
                <textarea
                  dir="rtl"
                  value={form.description_ar}
                  onChange={(e) => update('description_ar', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white text-right placeholder:text-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Price *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price === 0 ? 0 : form.price || ''}
                    onChange={(e) => update('price', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    className="bg-slate-800 border-slate-600 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Sold by</label>
                  <select
                    value={form.saleUnit || 'piece'}
                    onChange={(e) => update('saleUnit', e.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                  >
                    {SALE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label_en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Currency</label>
                  <Input
                    value={form.currency}
                    onChange={(e) => update('currency', e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Special price</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.specialPrice}
                    onChange={(e) => update('specialPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Expires at</label>
                  <Input
                    type="datetime-local"
                    value={form.specialPriceExpires}
                    onChange={(e) => update('specialPriceExpires', e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Main image</label>
                <p className="mb-2 text-[10px] text-slate-500">
                  Allowed: JPEG, PNG, WebP, GIF. Max {MAX_IMAGE_SIZE_MB} MB. Recommended: 1200×800 px (or 800×800). Compress large images to avoid errors.
                </p>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-600 bg-slate-800/50">
                    {mainImagePreview ? (
                      <img src={mainImagePreview} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-8 text-slate-500" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={mainInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadMainImage(e.target.files[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      onClick={() => mainInputRef.current?.click()}
                      disabled={mainImageUploading}
                    >
                      <Upload className="mr-2 size-4" />
                      {mainImageUploading ? 'Uploading…' : 'Upload image'}
                    </Button>
                    {uploadError && (
                      <p className="mt-2 rounded-md border border-red-500/50 bg-red-950/30 px-3 py-2 text-sm text-red-400" role="alert">{uploadError}</p>
                    )}
                    <p className="text-[10px] text-slate-500">Or paste URL below</p>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={form.imageUrl}
                      onChange={(e) => { update('imageUrl', e.target.value); if (form.imageAssetId) setForm((f) => ({ ...f, imageAssetId: undefined })); setMainImagePreview(null) }}
                      className="h-8 bg-slate-800 border-slate-600 text-white text-xs"
                    />
                    {product?.catalogRef && form.imageAssetId && (
                      <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={form.contributeImageToCatalog !== false}
                          onChange={(e) => update('contributeImageToCatalog', e.target.checked)}
                          className="rounded border-slate-600 bg-slate-800"
                        />
                        Contribute this image to catalog for other markets
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">More images (gallery)</label>
                <p className="mb-2 text-[10px] text-slate-500">
                  Same rules: JPEG, PNG, WebP, GIF. Max 20 MB. Recommended: 1200×800 or 800×800 px.
                </p>
                <div className="flex flex-wrap gap-2 items-start">
                  {additionalPreviews.map((p, i) => (
                    <div key={p.id} className="relative">
                      <img src={p.url} alt="" className="size-16 rounded-lg object-cover border border-slate-600" />
                      <button
                        type="button"
                        onClick={() => removeAdditionalImage(i)}
                        className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-white"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                  <input
                    ref={additionalInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => uploadAdditionalImages(e.target.files)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-16 w-16 shrink-0 border-dashed border-slate-600 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300"
                    onClick={() => additionalInputRef.current?.click()}
                    disabled={additionalUploading}
                  >
                    {additionalUploading ? (
                      <span className="text-[10px]">…</span>
                    ) : (
                      <Plus className="size-6" />
                    )}
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">Optional. Add multiple images for this product.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Category *</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => update('categoryId', e.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.title_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Sort order</label>
                <Input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => update('sortOrder', parseInt(e.target.value, 10) || 0)}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.isPopular}
                    onChange={(e) => update('isPopular', e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800"
                  />
                  Popular
                </label>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Ingredients (EN, one per line)</label>
                <textarea
                  value={ingredientsEnText}
                  onChange={(e) => setIngredientsEnText(e.target.value)}
                  rows={2}
                  placeholder="Ingredient 1&#10;Ingredient 2"
                  className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Ingredients (AR, one per line)</label>
                <textarea
                  dir="rtl"
                  value={ingredientsArText}
                  onChange={(e) => setIngredientsArText(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white text-right placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Dietary tags</label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleDietary(opt.value)}
                      className={`rounded-full px-3 py-1 text-xs ${form.dietaryTags.includes(opt.value) ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-700/50 text-slate-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-base font-medium text-slate-300">Variants (e.g. Size, Color)</label>
                  <Button type="button" variant="ghost" size="sm" className="h-10 text-sm text-slate-400" onClick={addVariantGroup}>
                    <Plus className="mr-1.5 size-4" /> Add group
                  </Button>
                </div>
                <p className="mb-2 text-sm text-slate-500">Use 0 for free (e.g. Small 0, Medium +35). Check &quot;Required&quot; only when the customer must pick one (e.g. Size). Leave unchecked for optional groups (e.g. Make it a Meal). Drag to reorder.</p>
                {suggestionGroups.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] text-slate-500 mb-1.5">Quick add from other products (copied to this product only — you can add/remove options like 1TB here without affecting others):</p>
                    <div className="flex flex-wrap items-center gap-2">
                    {suggestionGroups
                      .filter((g) => !form.variants.some((v) => (v.name_en || '').trim().toLowerCase() === (g.name_en || '').trim().toLowerCase()))
                      .map((g, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => addVariantFromSuggestion(g)}
                          className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600 hover:text-white"
                        >
                          {g.name_en || g.name_ar || 'Variant'} ({(g.options || []).map((o) => o.label_en || o.label_ar).filter(Boolean).join(', ')})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVariantGroupsDragEnd}>
                  <SortableContext items={form.variants.map((_, i) => `vg-${i}`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-5">
                      {form.variants.map((group, gi) => (
                        <SortableItem key={gi} id={`vg-${gi}`} className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
                          {({ attributes, listeners }) => (
                            <div className="p-5 space-y-4">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  className="touch-none select-none flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-700/50 p-3 text-slate-400 hover:bg-slate-700 hover:text-slate-200 cursor-grab active:cursor-grabbing"
                                  title="Drag to reorder group"
                                  {...attributes}
                                  {...listeners}
                                >
                                  <GripVertical className="size-6" />
                                </button>
                                <div className="flex-1 grid gap-3">
                                  <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-400">Group name (English)</label>
                                    <Input
                                      placeholder="e.g. Size"
                                      value={group.name_en}
                                      onChange={(e) => updateVariantGroup(gi, 'name_en', e.target.value)}
                                      className="h-11 bg-slate-800 border-slate-600 text-white text-base"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-400">Group name (Arabic)</label>
                                    <Input
                                      dir="rtl"
                                      placeholder="مثال: الحجم"
                                      value={group.name_ar}
                                      onChange={(e) => updateVariantGroup(gi, 'name_ar', e.target.value)}
                                      className="h-11 bg-slate-800 border-slate-600 text-white text-base text-right"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 pt-2">
                                    <input
                                      type="checkbox"
                                      id={`variant-required-${gi}`}
                                      checked={group.required === true}
                                      onChange={(e) => updateVariantGroup(gi, 'required', e.target.checked)}
                                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                                    />
                                    <label htmlFor={`variant-required-${gi}`} className="text-sm text-slate-400">
                                      Required (customer must pick one)
                                    </label>
                                  </div>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-red-400" onClick={() => removeVariantGroup(gi)}>
                                  <Trash2 className="size-5" />
                                </Button>
                              </div>
                              <div className="pl-11 space-y-4 border-l-2 border-slate-700/50">
                                <p className="text-sm font-medium text-slate-500">Options</p>
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVariantOptionsDragEnd(gi)}>
                                  <SortableContext items={group.options.map((_, oi) => `vo-${gi}-${oi}`)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-4">
                                      {group.options.map((opt, oi) => (
                                        <SortableItem key={oi} id={`vo-${gi}-${oi}`} className="rounded-lg bg-slate-800/80">
                                          {({ attributes: optAttrs, listeners: optListeners }) => (
                                            <div className="p-4 flex items-start gap-3">
                                              <button
                                                type="button"
                                                className="touch-none select-none flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-700/50 p-2.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 cursor-grab active:cursor-grabbing mt-5"
                                                title="Drag to reorder option"
                                                {...optAttrs}
                                                {...optListeners}
                                              >
                                                <GripVertical className="size-5" />
                                              </button>
                                              <div className="flex-1 grid gap-3 min-w-0">
                                                <div>
                                                  <label className="mb-1 block text-xs font-medium text-slate-500">English</label>
                                                  <Input
                                                    placeholder="e.g. Small"
                                                    value={opt.label_en}
                                                    onChange={(e) => updateVariantOption(gi, oi, 'label_en', e.target.value)}
                                                    className="h-10 bg-slate-800 border-slate-600 text-white text-sm"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="mb-1 block text-xs font-medium text-slate-500">Arabic</label>
                                                  <Input
                                                    dir="rtl"
                                                    placeholder="مثال: صغير"
                                                    value={opt.label_ar}
                                                    onChange={(e) => updateVariantOption(gi, oi, 'label_ar', e.target.value)}
                                                    className="h-10 bg-slate-800 border-slate-600 text-white text-sm text-right"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="mb-1 block text-xs font-medium text-slate-500">Price modifier (0 = free)</label>
                                                  <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="0"
                                                    value={(typeof opt.priceModifier === 'number' && opt.priceModifier === 0) ? '' : (typeof opt.priceModifier === 'number' ? opt.priceModifier : '')}
                                                    onChange={(e) => {
                                                      const raw = e.target.value
                                                      if (raw === '') {
                                                        updateVariantOption(gi, oi, 'priceModifier', 0)
                                                        return
                                                      }
                                                      const v = parseFloat(raw)
                                                      updateVariantOption(gi, oi, 'priceModifier', Number.isFinite(v) ? v : 0)
                                                    }}
                                                    className="h-10 w-28 bg-slate-800 border-slate-600 text-white text-sm"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="mb-1 block text-xs font-medium text-slate-500">Special price (optional)</label>
                                                  <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="—"
                                                    value={typeof opt.specialPriceModifier === 'number' ? opt.specialPriceModifier : ''}
                                                    onChange={(e) => {
                                                      const raw = e.target.value
                                                      if (raw === '') {
                                                        updateVariantOption(gi, oi, 'specialPriceModifier', undefined)
                                                        return
                                                      }
                                                      const v = parseFloat(raw)
                                                      updateVariantOption(gi, oi, 'specialPriceModifier', Number.isFinite(v) ? v : 0)
                                                    }}
                                                    className="h-10 w-28 bg-slate-800 border-slate-600 text-white text-sm"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="mb-1 block text-xs font-medium text-slate-500">Special expires at</label>
                                                  <Input
                                                    type="datetime-local"
                                                    value={opt.specialPriceModifierExpires ? String(opt.specialPriceModifierExpires).slice(0, 16) : ''}
                                                    onChange={(e) => updateVariantOption(gi, oi, 'specialPriceModifierExpires', e.target.value)}
                                                    className="h-10 bg-slate-800 border-slate-600 text-white text-sm"
                                                  />
                                                </div>
                                                <div className="flex items-center gap-2 pt-1">
                                                  <input
                                                    type="checkbox"
                                                    id={`vo-default-${gi}-${oi}`}
                                                    checked={opt.isDefault === true}
                                                    onChange={(e) => setVariantOptionDefault(gi, e.target.checked ? oi : null)}
                                                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                                                  />
                                                  <label htmlFor={`vo-default-${gi}-${oi}`} className="text-xs text-slate-400">
                                                    Default (pre-selected for customer)
                                                  </label>
                                                </div>
                                                <div>
                                                  <label className="mb-1 block text-xs font-medium text-slate-500">Option image</label>
                                                  <div className="flex items-center gap-2">
                                                    {opt.imageAssetId ? (
                                                      <div className="relative">
                                                        <img
                                                          src={urlFor({ _type: 'image', asset: { _type: 'reference', _ref: opt.imageAssetId } }).width(80).height(80).url()}
                                                          alt=""
                                                          className="size-14 rounded-lg object-cover border border-slate-600"
                                                        />
                                                        <button
                                                          type="button"
                                                          onClick={() => updateVariantOption(gi, oi, 'imageAssetId', undefined)}
                                                          className="absolute -right-1 -top-1 size-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                                                        >
                                                          <Trash2 className="size-3" />
                                                        </button>
                                                      </div>
                                                    ) : null}
                                                    <input
                                                      ref={variantOptionImageInputRef}
                                                      type="file"
                                                      accept="image/jpeg,image/png,image/webp,image/gif"
                                                      className="hidden"
                                                      onChange={(e) => {
                                                        const pending = pendingVariantImageUpload
                                                        const file = e.target.files?.[0]
                                                        if (pending && file) uploadVariantOptionImage(pending.gi, pending.oi, file)
                                                      }}
                                                    />
                                                    <Button
                                                      type="button"
                                                      variant="outline"
                                                      size="sm"
                                                      className="border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                                                      onClick={() => {
                                                        setPendingVariantImageUpload({ gi, oi })
                                                        variantOptionImageInputRef.current?.click()
                                                      }}
                                                      disabled={!!pendingVariantImageUpload}
                                                    >
                                                      <Upload className="size-3.5 mr-1" />
                                                      {opt.imageAssetId ? 'Change' : 'Upload'}
                                                    </Button>
                                                  </div>
                                                  <p className="text-[10px] text-slate-500 mt-0.5">Shown when customer selects this option</p>
                                                </div>
                                              </div>
                                              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-red-400 mt-6" onClick={() => removeVariantOption(gi, oi)} disabled={group.options.length <= 1}>
                                                <Trash2 className="size-4" />
                                              </Button>
                                            </div>
                                          )}
                                        </SortableItem>
                                      ))}
                                    </div>
                                  </SortableContext>
                                </DndContext>
                                <Button type="button" variant="ghost" size="sm" className="h-9 text-sm text-slate-500" onClick={() => addVariantOption(gi)}>
                                  <Plus className="mr-1.5 size-4" /> Add option
                                </Button>
                              </div>
                            </div>
                          )}
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-base font-medium text-slate-300">Add-ons</label>
                  <Button type="button" variant="ghost" size="sm" className="h-10 text-sm text-slate-400" onClick={addAddOn}>
                    <Plus className="mr-1.5 size-4" /> Add
                  </Button>
                </div>
                <p className="mb-2 text-sm text-slate-500">Use 0 for free (e.g. extra ketchup 0, extra cheese +5). Drag the handle to reorder.</p>
                {suggestionAddOns.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] text-slate-500 mb-1.5">Quick add from other products (copied to this product only):</p>
                    <div className="flex flex-wrap items-center gap-2">
                    {suggestionAddOns
                      .filter((a) => !form.addOns.some((x) => (x.name_en || '').trim().toLowerCase() === (a.name_en || '').trim().toLowerCase()))
                      .map((a, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => addAddOnFromSuggestion(a)}
                          className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600 hover:text-white"
                        >
                          {a.name_en || a.name_ar} {a.price !== 0 ? `+${a.price}` : '(free)'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAddOnsDragEnd}>
                  <SortableContext items={form.addOns.map((_, i) => `addon-${i}`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-5">
                      {form.addOns.map((addOn, i) => (
                        <SortableItem key={i} id={`addon-${i}`} className="rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden">
                          {({ attributes, listeners }) => (
                            <div className="p-5 flex gap-4 items-start">
                              <button
                                type="button"
                                className="touch-none select-none flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-700/50 p-3 text-slate-400 hover:bg-slate-700 hover:text-slate-200 cursor-grab active:cursor-grabbing"
                                title="Drag to reorder"
                                {...attributes}
                                {...listeners}
                              >
                                <GripVertical className="size-6" />
                              </button>
                              <div className="flex-1 grid gap-4 min-w-0">
                                <div>
                                  <label className="mb-1.5 block text-sm font-medium text-slate-400">English</label>
                                  <Input
                                    placeholder="e.g. Extra cheese"
                                    value={addOn.name_en}
                                    onChange={(e) => updateAddOn(i, 'name_en', e.target.value)}
                                    className="h-11 bg-slate-800 border-slate-600 text-white text-base"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1.5 block text-sm font-medium text-slate-400">Arabic</label>
                                  <Input
                                    dir="rtl"
                                    placeholder="مثال: جبن إضافي"
                                    value={addOn.name_ar}
                                    onChange={(e) => updateAddOn(i, 'name_ar', e.target.value)}
                                    className="h-11 bg-slate-800 border-slate-600 text-white text-base text-right"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1.5 block text-sm font-medium text-slate-400">Price (0 = free)</label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0"
                                    value={addOn.price === 0 ? '' : (typeof addOn.price === 'number' ? addOn.price : '')}
                                    onChange={(e) => {
                                      const raw = e.target.value
                                      if (raw === '') {
                                        updateAddOn(i, 'price', 0)
                                        return
                                      }
                                      const v = parseFloat(raw)
                                      updateAddOn(i, 'price', Number.isFinite(v) ? v : 0)
                                    }}
                                    className="h-11 w-32 bg-slate-800 border-slate-600 text-white text-base"
                                  />
                                </div>
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-red-400" onClick={() => removeAddOn(i)}>
                                <Trash2 className="size-5" />
                              </Button>
                            </div>
                          )}
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-row gap-2 border-t border-slate-700/60 px-4 py-3">
            <Button type="button" variant="outline" size="sm" className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-amber-500 text-slate-950 hover:bg-amber-400" disabled={saving}>
              {saving ? 'Saving…' : product ? 'Save' : 'Add product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
