'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Package, CheckCircle, Plus, Upload, Link2, Pencil, Languages } from 'lucide-react'
import { compressImageForUpload } from '@/lib/compress-image'

const CATEGORIES = [
  { value: 'grocery', label: 'Grocery / Market' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'retail', label: 'Retail / Shop' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'other', label: 'Other' },
]

const UNIT_TYPES = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Per kg' },
  { value: 'pack', label: 'Per pack' },
]

const PAGE_SIZE = 50

type MasterCatalogItem = {
  _id: string
  nameEn?: string
  nameAr?: string
  descriptionEn?: string
  descriptionAr?: string
  category?: string
  searchQuery?: string
  unitType?: string
  imageUrl?: string | null
}

function ProductCard({
  product,
  categories,
  onSaved,
}: {
  product: MasterCatalogItem
  categories: typeof CATEGORIES
  onSaved: (updated?: MasterCatalogItem) => void
}) {
  const [nameEn, setNameEn] = useState(product.nameEn ?? '')
  const [nameAr, setNameAr] = useState(product.nameAr ?? '')
  const [descriptionEn, setDescriptionEn] = useState(product.descriptionEn ?? '')
  const [descriptionAr, setDescriptionAr] = useState(product.descriptionAr ?? '')
  const [category, setCategory] = useState(product.category ?? 'grocery')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setNameEn(product.nameEn ?? '')
    setNameAr(product.nameAr ?? '')
    setDescriptionEn(product.descriptionEn ?? '')
    setDescriptionAr(product.descriptionAr ?? '')
    setCategory(product.category ?? 'grocery')
  }, [product._id, product.nameEn, product.nameAr, product.descriptionEn, product.descriptionAr, product.category])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith('image/')) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
    e.target.value = ''
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      let imageAssetId: string | undefined
      if (imageFile) {
        const compressed = await compressImageForUpload(imageFile)
        const fd = new FormData()
        fd.append('file', compressed)
        const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? 'Image upload failed')
        }
        const uploadData = await uploadRes.json()
        imageAssetId = uploadData._id
      }
      const body: Record<string, unknown> = {
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        descriptionEn: descriptionEn.trim() || undefined,
        descriptionAr: descriptionAr.trim() || undefined,
        category,
      }
      if (imageAssetId) body.imageAssetId = imageAssetId
      const res = await fetch(`/api/admin/master-catalog/${product._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to save')
      setImageFile(null)
      if (imagePreview) URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      const updated = (data as { product?: MasterCatalogItem }).product
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const displayImage = imagePreview || product.imageUrl

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3">
      <div className="flex gap-4">
        <div
          className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-slate-700 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {displayImage ? (
            <Image src={displayImage} alt="" fill className="object-cover" sizes="80px" unoptimized />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Pencil className="size-6 text-slate-500" />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="Name (English)"
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
          />
          <input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder="اسم (عربي)"
            dir="rtl"
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
          />
        </div>
      </div>
      <textarea
        value={descriptionEn}
        onChange={(e) => setDescriptionEn(e.target.value)}
        placeholder="Description (English)"
        rows={2}
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder:text-slate-500 resize-none"
      />
      <textarea
        value={descriptionAr}
        onChange={(e) => setDescriptionAr(e.target.value)}
        placeholder="الوصف (عربي)"
        dir="rtl"
        rows={2}
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder:text-slate-500 resize-none"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white"
      >
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <CheckCircle className="size-4" /> : null}
          {saving ? ' Saving…' : saved ? ' Saved' : ' Save'}
        </Button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}

export default function AdminCatalogPage() {
  const [loading, setLoading] = useState(false)
  const [loadingMaster, setLoadingMaster] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; categoriesCreated?: number; productsCreated?: number; message?: string } | null>(null)
  const [masterResult, setMasterResult] = useState<{ ok: boolean; productsCreated?: number; message?: string } | null>(null)

  // Manual add state
  const [nameEn, setNameEn] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [category, setCategory] = useState('grocery')
  const [unitType, setUnitType] = useState('piece')
  const [searchQuery, setSearchQuery] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)

  // Import from Baladi URL
  const [importUrl, setImportUrl] = useState('')
  const [importCategory, setImportCategory] = useState('grocery')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: boolean; message?: string; productsCreated?: number; productsUpdated?: number } | null>(null)

  // AI Translate & Fill
  const [translating, setTranslating] = useState(false)
  const [translateResult, setTranslateResult] = useState<{
    ok: boolean
    message?: string
    totalNeedingWork?: number
    processed?: number
    updated?: number
    failed?: number
    dryRun?: boolean
  } | null>(null)

  // Existing products (paginated)
  const [products, setProducts] = useState<MasterCatalogItem[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [searchFilter, setSearchFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const fetchProducts = useCallback(async (offset = 0) => {
    const append = offset > 0
    if (!append) setProductsLoading(true)
    else setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (searchFilter.trim()) params.set('q', searchFilter.trim())
      if (categoryFilter) params.set('category', categoryFilter)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(offset))
      const res = await fetch(`/api/admin/master-catalog?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      const items = data.items ?? []
      const newTotal = data.total ?? items.length
      const newHasMore = data.hasMore ?? false
      setTotal(newTotal)
      setHasMore(newHasMore)
      setProducts((prev) => (append ? [...prev, ...items] : items))
    } catch {
      if (!append) setProducts([])
    } finally {
      setProductsLoading(false)
      setLoadingMore(false)
    }
  }, [searchFilter, categoryFilter])

  useEffect(() => {
    fetchProducts(0)
  }, [fetchProducts])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) fetchProducts(products.length)
  }, [fetchProducts, loadingMore, hasMore, products.length])

  const handleProductSaved = useCallback((updated?: MasterCatalogItem) => {
    if (updated) {
      setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)))
    }
  }, [])

  const handleSeed = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/seed-catalog', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      setResult(data)
    } catch {
      setResult({ ok: false, message: 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleSeedMaster = async () => {
    setLoadingMaster(true)
    setMasterResult(null)
    try {
      const res = await fetch('/api/admin/seed-master-catalog', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      setMasterResult(data)
      if (data.ok) fetchProducts()
    } catch {
      setMasterResult({ ok: false, message: 'Request failed' })
    } finally {
      setLoadingMaster(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith('image/')) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
      setSearchQuery((prev) => (prev ? prev : ''))
    }
    e.target.value = ''
  }

  const clearImage = () => {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
  }

  const handleImportFromUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    setImportResult(null)
    const url = importUrl.trim()
    if (!url) return
    setImporting(true)
    try {
      const res = await fetch('/api/admin/import-baladi-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, marketCategory: importCategory }),
      })
      const data = await res.json().catch(() => ({}))
      setImportResult({
        ok: data.ok ?? false,
        message: data.message ?? (res.ok ? 'Import complete' : 'Import failed'),
        productsCreated: data.productsCreated,
        productsUpdated: data.productsUpdated,
      })
      if (data.ok) fetchProducts()
    } catch {
      setImportResult({ ok: false, message: 'Request failed' })
    } finally {
      setImporting(false)
    }
  }

  const handleTranslate = async (dryRun = false) => {
    setTranslateResult(null)
    setTranslating(true)
    try {
      const res = await fetch('/api/admin/translate-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50, dryRun }),
      })
      const data = await res.json().catch(() => ({}))
      setTranslateResult({
        ok: data.ok ?? false,
        message: data.message ?? (res.ok ? 'Done' : 'Failed'),
        totalNeedingWork: data.totalNeedingWork,
        processed: data.processed,
        updated: data.updated,
        failed: data.failed,
        dryRun: data.dryRun,
      })
      if (data.ok && !dryRun && (data.updated ?? 0) > 0) fetchProducts()
    } catch {
      setTranslateResult({ ok: false, message: 'Request failed' })
    } finally {
      setTranslating(false)
    }
  }

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    setAddSuccess(false)
    if (!nameEn.trim() || !nameAr.trim()) {
      setAddError('Name (English) and Name (Arabic) are required')
      return
    }
    if (!imageFile && (!searchQuery.trim() || searchQuery.trim().length < 2)) {
      setAddError('Either upload an image or enter a search query (min 2 characters) for Unsplash')
      return
    }
    setAdding(true)
    try {
      let imageAssetId: string | undefined
      if (imageFile) {
        const compressed = await compressImageForUpload(imageFile)
        const fd = new FormData()
        fd.append('file', compressed)
        const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? 'Image upload failed')
        }
        const uploadData = await uploadRes.json()
        imageAssetId = uploadData._id
      }
      const body: Record<string, string | undefined> = {
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        category,
        unitType,
        searchQuery: searchQuery.trim() || undefined,
        imageAssetId,
      }
      const res = await fetch('/api/admin/master-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'Failed to add product')
      }
      setAddSuccess(true)
      setNameEn('')
      setNameAr('')
      setSearchQuery('')
      clearImage()
      fetchProducts()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Product Catalog</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">
        Palestinian market product catalog for grocery, supermarket, and greengrocer tenants. Seed categories and products so markets can add them to their menus.
      </p>

      {/* ═══ MANUAL ADD ═══ */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-blue-500/20 p-3">
            <Plus className="size-6 text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Manually add product</h2>
            <p className="text-sm text-slate-400">
              Add products with names and images. They will show up for markets and groceries in the quick-add catalog.
            </p>
          </div>
        </div>
        <form onSubmit={handleManualAdd} className="space-y-4 max-w-md">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Name (English) *</label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Tomatoes"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Name (Arabic) *</label>
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="e.g. طماطم"
                dir="rtl"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Unit type</label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                {UNIT_TYPES.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Image (optional)</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="manual-add-image"
              />
              <label
                htmlFor="manual-add-image"
                className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/50 text-slate-500 transition hover:border-slate-500 hover:text-slate-400"
              >
                {imagePreview ? (
                  <Image src={imagePreview} alt="" width={96} height={96} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <Upload className="size-8" />
                )}
              </label>
              {imagePreview && (
                <Button type="button" variant="ghost" size="sm" onClick={clearImage} className="text-slate-400 hover:text-white">
                  Remove
                </Button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">When uploaded, this image is used for quick-add. Otherwise Unsplash is used.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Unsplash search query {!imageFile && '*'}
            </label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={imageFile ? 'Optional fallback' : 'e.g. fresh tomatoes on wooden table'}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
            {!imageFile && (
              <p className="mt-1 text-[11px] text-slate-500">Required when no image is uploaded. Used to fetch image from Unsplash.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={adding} className="bg-blue-600 hover:bg-blue-500">
              {adding ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {adding ? 'Adding…' : 'Add product'}
            </Button>
            {addSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle className="size-4" />
                Product added
              </span>
            )}
          </div>
          {addError && (
            <p className="text-sm text-red-400">{addError}</p>
          )}
        </form>
      </div>

      {/* ═══ IMPORT FROM BALADI URL ═══ */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-violet-500/20 p-3">
            <Link2 className="size-6 text-violet-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Import from Baladi category URL</h2>
            <p className="text-sm text-slate-400">
              Paste a Baladi category URL to scrape and import products. Example: https://www.baladisupermarket.com/categories/95010/products
            </p>
          </div>
        </div>
        <form onSubmit={handleImportFromUrl} className="flex flex-wrap items-end gap-4 max-w-2xl">
          <div className="flex-1 min-w-[280px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">Category URL</label>
            <Input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://www.baladisupermarket.com/categories/95010/products"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-slate-400">Market category</label>
            <select
              value={importCategory}
              onChange={(e) => setImportCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={importing} className="bg-violet-600 hover:bg-violet-500">
            {importing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </form>
        {importResult && (
          <div className={`mt-4 flex flex-col gap-2 rounded-lg p-4 ${importResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            <div className="flex items-center gap-2">
              {importResult.ok && <CheckCircle className="size-5 shrink-0" />}
              <span>{importResult.message}</span>
            </div>
            {importResult.ok && ((importResult.productsCreated ?? 0) + (importResult.productsUpdated ?? 0) > 0) && (
              <span className="text-sm opacity-90">
                Created: {importResult.productsCreated ?? 0}, Updated: {importResult.productsUpdated ?? 0}
              </span>
            )}
            {!importResult.ok && (
              <div className="mt-2 space-y-2 text-xs text-slate-500">
                <p>Cloudflare blocks headless scraping. Run this in your terminal (a browser will open—solve the Cloudflare check, then press Enter):</p>
                <code className="block rounded bg-slate-800 px-2 py-1.5 font-mono text-[11px] break-all select-all">
                  npm run import:baladi:url -- --url &quot;{importUrl}&quot; --market-category {importCategory}
                </code>
                <p className="text-slate-600">Or use the full command: <code className="rounded bg-slate-800/50 px-1">npx tsx scripts/import-baladi.ts --url &quot;{importUrl}&quot; --market-category {importCategory} --interactive-auth</code></p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ AI TRANSLATE & FILL ═══ */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-sky-500/20 p-3">
            <Languages className="size-6 text-sky-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">AI Translate & Fill</h2>
            <p className="text-sm text-slate-400">
              Uses OpenAI to translate titles/descriptions (EN↔AR), generate missing descriptions from product names and Palestinian/Israeli market knowledge, and infer unit types. Processes products missing one or more fields.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleTranslate(false)}
            disabled={translating}
            className="bg-sky-600 hover:bg-sky-500"
          >
            {translating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Languages className="mr-2 size-4" />}
            {translating ? 'Translating…' : 'Translate & Fill (50 max)'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleTranslate(true)}
            disabled={translating}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            {translating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Dry run (preview)
          </Button>
        </div>
        {translateResult && (
          <div
            className={`mt-4 flex flex-col gap-2 rounded-lg p-4 ${
              translateResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {translateResult.ok && <CheckCircle className="size-5 shrink-0" />}
              <span>{translateResult.message}</span>
            </div>
            {translateResult.totalNeedingWork != null && (
              <span className="text-sm opacity-90">
                {translateResult.totalNeedingWork} products need work · Processed: {translateResult.processed ?? 0}
                {!translateResult.dryRun && (
                  <> · Updated: {translateResult.updated ?? 0} · Failed: {translateResult.failed ?? 0}</>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ═══ EXISTING PRODUCTS (paginated, inline editable) ═══ */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="font-semibold text-white mb-4">Master catalog products</h2>
        <p className="text-sm text-slate-400 mb-4">
          Edit directly below. Scroll down to load more (50 per page). Search finds any product.
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <Input
            placeholder="Search by name…"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="max-w-xs bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="self-center text-xs text-slate-500">
            {total > 0 ? `${products.length} of ${total} shown` : ''}
          </span>
        </div>
        {productsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-slate-400" />
          </div>
        ) : products.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            No products yet. Use &quot;Manually add product&quot; above or run &quot;Seed master catalog&quot; below.
          </p>
        ) : (
          <div
            ref={scrollContainerRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pr-2"
            onScroll={(e) => {
              const el = e.currentTarget
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadMore()
            }}
          >
            {products.map((p) => (
              <ProductCard
                key={p._id}
                product={p}
                categories={CATEGORIES}
                onSaved={handleProductSaved}
              />
            ))}
          </div>
        )}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="size-6 animate-spin text-slate-400" />
          </div>
        )}
        {hasMore && !loadingMore && products.length > 0 && (
          <div className="flex justify-center py-4">
            <Button variant="outline" onClick={loadMore} className="border-slate-600 text-slate-300">
              Load more
            </Button>
          </div>
        )}
      </div>

      {/* ═══ SEED CATALOG ═══ */}
      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-full bg-amber-500/20 p-3">
            <Package className="size-6 text-amber-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Seed Catalog</h2>
            <p className="mt-1 text-sm text-slate-400">
              Creates 13 categories (Fruits, Dairy, Beverages, etc.) and 100+ products (Tomatoes, Coca Cola, Bamba, Tnuva Milk, etc.) based on the Palestinian market. Run once. If catalog already exists, delete categories/products in Studio first.
            </p>
            <Button
              onClick={handleSeed}
              disabled={loading}
              className="mt-4 bg-amber-600 hover:bg-amber-500"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {loading ? 'Seeding…' : 'Seed catalog'}
            </Button>
          </div>
        </div>
        {result && (
          <div className={`mt-6 flex items-center gap-2 rounded-lg p-4 ${result.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {result.ok ? <CheckCircle className="size-5 shrink-0" /> : null}
            <span>
              {result.ok
                ? `Catalog seeded: ${result.categoriesCreated} categories, ${result.productsCreated} products.`
                : result.message ?? 'Failed to seed.'}
            </span>
          </div>
        )}
      </div>

      {/* ═══ SEED MASTER CATALOG ═══ */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-full bg-emerald-500/20 p-3">
            <Package className="size-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Seed Master Catalog</h2>
            <p className="mt-1 text-sm text-slate-400">
              Creates bilingual quick-add templates (Eggs, Milk, Tomatoes, etc.) with Arabic/English names, search prompts for Unsplash, and unit type defaults. Safe to run again to add missing items.
            </p>
            <Button
              onClick={handleSeedMaster}
              disabled={loadingMaster}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500"
            >
              {loadingMaster ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {loadingMaster ? 'Seeding…' : 'Seed master catalog'}
            </Button>
          </div>
        </div>
        {masterResult && (
          <div className={`mt-6 flex items-center gap-2 rounded-lg p-4 ${masterResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {masterResult.ok ? <CheckCircle className="size-5 shrink-0" /> : null}
            <span>
              {masterResult.ok
                ? `Master catalog seeded: ${masterResult.productsCreated} products.`
                : masterResult.message ?? 'Failed to seed master catalog.'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
