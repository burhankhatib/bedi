'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Package, CheckCircle, Plus, Upload, Link2, Pencil, Languages, Copy, Trash2, Merge, Zap } from 'lucide-react'
import { compressImageForUpload } from '@/lib/compress-image'
import { needsTranslation } from '@/lib/master-catalog-translation'

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

  // Import from Baladi (category numbers — run locally)
  const [categoryIdsInput, setCategoryIdsInput] = useState('')
  const [importCategory, setImportCategory] = useState('grocery')
  const [importResult, setImportResult] = useState<{ ok: boolean; message?: string } | null>(null)

  // Import from Talabat (create full business — run locally)
  const [talabatUrl, setTalabatUrl] = useState('')
  const [talabatResult, setTalabatResult] = useState<{ ok: boolean; message?: string } | null>(null)

  // AI Translate & Fill
  const [translating, setTranslating] = useState(false)
  const [backgroundTranslating, setBackgroundTranslating] = useState(false)
  const [backgroundStats, setBackgroundStats] = useState({ done: 0, translated: 0, failed: 0, remaining: 0 })
  const backgroundCancelledRef = useRef(false)
  const [translateProgress, setTranslateProgress] = useState<
    Array<{ _id: string; index: number; total: number; nameEn?: string; nameAr?: string; ok?: boolean; error?: string; updated?: string[]; translatedNameEn?: string; translatedNameAr?: string }>
  >([])
  const [translateResult, setTranslateResult] = useState<{
    ok: boolean
    message?: string
    totalNeedingWork?: number
    processed?: number
    translated?: number
    skipped?: number
    failed?: number
    remaining?: number
    errorSamples?: string[]
    dryRun?: boolean
  } | null>(null)

  // Duplicates (find, merge, delete)
  type DuplicateProduct = {
    _id: string
    nameEn?: string | null
    nameAr?: string | null
    category?: string | null
    imageUrl?: string | null
  }
  const [findingDuplicates, setFindingDuplicates] = useState(false)
  const [duplicateGroups, setDuplicateGroups] = useState<Array<{ key: string; products: DuplicateProduct[] }>>([])
  const [duplicateResult, setDuplicateResult] = useState<{ ok: boolean; message?: string } | null>(null)
  const [actingOnDuplicate, setActingOnDuplicate] = useState<string | null>(null)
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())

  // Existing products (paginated)
  const [products, setProducts] = useState<MasterCatalogItem[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [searchFilter, setSearchFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [needsTranslationFilter, setNeedsTranslationFilter] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const fetchProducts = useCallback(async (offset = 0) => {
    const append = offset > 0
    if (!append) setProductsLoading(true)
    else setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (searchFilter.trim()) params.set('q', searchFilter.trim())
      if (categoryFilter) params.set('category', categoryFilter)
      if (needsTranslationFilter) {
        params.set('needsTranslation', '1')
        params.set('_', String(Date.now()))
      }
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
  }, [searchFilter, categoryFilter, needsTranslationFilter])

  useEffect(() => {
    fetchProducts(0)
  }, [fetchProducts])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) fetchProducts(products.length)
  }, [fetchProducts, loadingMore, hasMore, products.length])

  const handleProductSaved = useCallback(
    (updated?: MasterCatalogItem) => {
      if (!updated) return
      if (needsTranslationFilter && !needsTranslation(updated)) {
        setProducts((prev) => prev.filter((p) => p._id !== updated._id))
        setTotal((t) => Math.max(0, t - 1))
        return
      }
      setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)))
    },
    [needsTranslationFilter]
  )

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

  const getImportCommand = () => {
    const ids = categoryIdsInput
      .split(/[,\s]+/)
      .map((s) => s.replace(/\D/g, ''))
      .filter(Boolean)
    if (ids.length === 0) return ''
    return `npm run import:baladi:cat -- ${ids.join(' ')} ${importCategory}`
  }

  const handleCopyImportCommand = async (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = getImportCommand()
    if (!cmd) return
    setImportResult(null)
    try {
      await navigator.clipboard.writeText(cmd)
      setImportResult({ ok: true, message: 'Command copied. Paste in your terminal and run.' })
      setTimeout(() => setImportResult(null), 6000)
    } catch {
      setImportResult({ ok: false, message: 'Could not copy. Run the command below in your terminal.' })
    }
  }

  const getTalabatCommand = () => {
    const url = talabatUrl.trim()
    if (!url || !url.includes('talabat.com')) return ''
    return `npm run import:talabat:url -- --url "${url}"`
  }

  const handleCopyTalabatCommand = async (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = getTalabatCommand()
    if (!cmd) return
    setTalabatResult(null)
    try {
      await navigator.clipboard.writeText(cmd)
      setTalabatResult({ ok: true, message: 'Command copied. Run in your terminal to create the business.' })
      setTimeout(() => setTalabatResult(null), 6000)
    } catch {
      setTalabatResult({ ok: false, message: 'Could not copy. Run the command below in your terminal.' })
    }
  }

  const handleTranslate = async (dryRun = false) => {
    setTranslateResult(null)
    setTranslateProgress([])
    setTranslating(true)
    try {
      const res = await fetch('/api/admin/translate-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50, dryRun, stream: !dryRun }),
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('x-ndjson') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const data = JSON.parse(line) as {
                type?: string
                index?: number
                total?: number
                _id?: string
                nameEn?: string
                nameAr?: string
                ok?: boolean
                error?: string
                updated?: string[]
                translatedNameEn?: string
                translatedNameAr?: string
                totalNeedingWork?: number
                translated?: number
                skipped?: number
                failed?: number
                remaining?: number
              }
              if (data.type === 'product') {
                setTranslateProgress((prev) => [
                  ...prev.filter((p) => p._id !== data._id),
                  {
                    _id: data._id ?? '',
                    index: data.index ?? 0,
                    total: data.total ?? 0,
                    nameEn: data.nameEn,
                    nameAr: data.nameAr,
                    ok: data.ok,
                    error: data.error,
                    updated: data.updated,
                    translatedNameEn: data.translatedNameEn,
                    translatedNameAr: data.translatedNameAr,
                  },
                ])
              } else if (data.type === 'done') {
                setTranslateResult({
                  ok: data.ok ?? false,
                  message:
                    (data.failed ?? 0) === 0
                      ? `Translated ${data.translated ?? 0}, skipped ${data.skipped ?? 0}. ${data.remaining ?? 0} remaining.`
                      : `Translated ${data.translated ?? 0}, skipped ${data.skipped ?? 0}, failed ${data.failed ?? 0}. ${data.remaining ?? 0} remaining.`,
                  totalNeedingWork: data.totalNeedingWork,
                  processed: data.total,
                  translated: data.translated,
                  skipped: data.skipped,
                  failed: data.failed,
                  remaining: data.remaining,
                  dryRun: false,
                })
                if ((data.translated ?? 0) > 0) fetchProducts()
              }
            } catch {
              /* skip malformed lines */
            }
          }
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setTranslateResult({
          ok: data.ok ?? false,
          message: data.message ?? (res.ok ? 'Done' : 'Failed'),
          totalNeedingWork: data.totalNeedingWork,
          processed: data.processed,
          translated: data.translated,
          skipped: data.skipped,
          failed: data.failed,
          remaining: data.remaining,
          errorSamples: data.errorSamples,
          dryRun: data.dryRun,
        })
        if (data.ok && !dryRun && (data.translated ?? 0) > 0) fetchProducts()
      }
    } catch {
      setTranslateResult({ ok: false, message: 'Request failed' })
    } finally {
      setTranslating(false)
    }
  }

  const BATCH_SIZE = 100
  const BATCH_DELAY_MS = 2000

  const handleBackgroundTranslate = async () => {
    if (backgroundTranslating || translating) return
    setBackgroundTranslating(true)
    backgroundCancelledRef.current = false
    setBackgroundStats({ done: 0, translated: 0, failed: 0, remaining: 0 })
    setTranslateResult(null)
    setTranslateProgress([])

    let skip = 0

    const runBatch = async (): Promise<{ remaining: number; translated: number; failed: number; processed: number } | null> => {
      if (backgroundCancelledRef.current) return null
      const res = await fetch('/api/admin/translate-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: BATCH_SIZE, skip, dryRun: false, stream: true }),
      })
      if (!res.ok || !res.body) return null
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('x-ndjson')) {
        const data = await res.json().catch(() => ({}))
        return {
          remaining: data.remaining ?? 0,
          translated: data.translated ?? 0,
          failed: data.failed ?? 0,
          processed: data.processed ?? 0,
        }
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let lastDone: { remaining: number; translated: number; failed: number; processed: number } | null = null
      while (true) {
        if (backgroundCancelledRef.current) break
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line) as {
              type?: string
              index?: number
              total?: number
              processed?: number
              _id?: string
              nameEn?: string
              nameAr?: string
              ok?: boolean
              error?: string
              updated?: string[]
              translatedNameEn?: string
              translatedNameAr?: string
              totalNeedingWork?: number
              translated?: number
              skipped?: number
              failed?: number
              remaining?: number
            }
            if (data.type === 'product' && data._id) {
              setTranslateProgress((prev) => [
                ...prev.filter((p) => p._id !== data._id),
                {
                  _id: data._id ?? '',
                  index: data.index ?? 0,
                  total: data.total ?? 0,
                  nameEn: data.nameEn,
                  nameAr: data.nameAr,
                  ok: data.ok,
                  error: data.error,
                  updated: data.updated as string[] | undefined,
                  translatedNameEn: data.translatedNameEn,
                  translatedNameAr: data.translatedNameAr,
                },
              ])
            } else if (data.type === 'done') {
              lastDone = {
                remaining: data.remaining ?? 0,
                translated: data.translated ?? 0,
                failed: data.failed ?? 0,
                processed: data.processed ?? data.total ?? 0,
              }
            }
          } catch {
            /* skip */
          }
        }
      }
      return lastDone
    }

    let totalDone = 0
    let totalTranslated = 0
    let totalFailed = 0
    let remaining = 1

    while (remaining > 0 && !backgroundCancelledRef.current) {
      const result = await runBatch()
      if (!result || backgroundCancelledRef.current) break
      totalDone += result.processed
      totalTranslated += result.translated
      totalFailed += result.failed
      remaining = result.remaining
      skip += result.processed
      setBackgroundStats({ done: totalDone, translated: totalTranslated, failed: totalFailed, remaining })
      if (remaining > 0) {
        setTranslateProgress([])
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    setBackgroundTranslating(false)
    setTranslateResult({
      ok: totalFailed === 0,
      message:
        remaining === 0
          ? `Background complete: ${totalTranslated} translated, ${totalDone} processed.`
          : backgroundCancelledRef.current
            ? `Stopped: ${totalTranslated} translated so far. ${remaining} remaining.`
            : `Finished: ${totalTranslated} translated, ${totalFailed} failed. ${remaining} remaining.`,
      totalNeedingWork: totalDone + remaining,
      processed: totalDone,
      translated: totalTranslated,
      failed: totalFailed,
      remaining,
    })
    if (totalTranslated > 0) fetchProducts()
  }

  const handleStopBackgroundTranslate = () => {
    backgroundCancelledRef.current = true
  }

  const handleFindDuplicates = async () => {
    setDuplicateResult(null)
    setDuplicateGroups([])
    setDismissedKeys(new Set())
    setFindingDuplicates(true)
    try {
      const res = await fetch('/api/admin/duplicate-products', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch')
      setDuplicateGroups(data.groups ?? [])
      setDuplicateResult({
        ok: true,
        message:
          (data.groups ?? []).length === 0
            ? 'No duplicates found.'
            : `Found ${data.totalDuplicates ?? 0} products in ${(data.groups ?? []).length} duplicate groups.`,
      })
    } catch (err) {
      setDuplicateResult({ ok: false, message: err instanceof Error ? err.message : 'Request failed' })
    } finally {
      setFindingDuplicates(false)
    }
  }

  const handleMergeDuplicates = async (keepId: string, mergeIds: string[]) => {
    setActingOnDuplicate(keepId)
    setDuplicateResult(null)
    try {
      const res = await fetch('/api/admin/duplicate-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'merge', keepId, mergeIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Merge failed')
      setDuplicateResult({ ok: true, message: data.message ?? 'Merged successfully.' })
      setDuplicateGroups((prev) => prev.filter((g) => !g.products.some((p) => p._id === keepId || mergeIds.includes(p._id))))
      fetchProducts()
    } catch (err) {
      setDuplicateResult({ ok: false, message: err instanceof Error ? err.message : 'Merge failed' })
    } finally {
      setActingOnDuplicate(null)
    }
  }

  const handleDeleteDuplicate = async (id: string, groupKey: string) => {
    setActingOnDuplicate(id)
    setDuplicateResult(null)
    try {
      const res = await fetch('/api/admin/duplicate-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      setDuplicateResult({ ok: true, message: data.message ?? 'Deleted.' })
      setDuplicateGroups((prev) =>
        prev
          .map((g) =>
            g.key === groupKey
              ? { ...g, products: g.products.filter((p) => p._id !== id) }
              : g
          )
          .filter((g) => g.products.length >= 2)
      )
      fetchProducts()
    } catch (err) {
      setDuplicateResult({ ok: false, message: err instanceof Error ? err.message : 'Delete failed' })
    } finally {
      setActingOnDuplicate(null)
    }
  }

  const handleLeaveDuplicates = (key: string) => {
    setDismissedKeys((prev) => new Set(prev).add(key))
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
      {backgroundTranslating && (
        <div className="sticky top-0 z-50 mb-4 flex items-center justify-between gap-4 rounded-xl border border-emerald-500/50 bg-emerald-950/90 px-4 py-3 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Loader2 className="size-5 animate-spin text-emerald-400 shrink-0" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-emerald-200">
                Translated: <strong className="text-emerald-400">{backgroundStats.translated}</strong>
              </span>
              <span className="text-slate-400">
                Done: {backgroundStats.done} · Remaining: {backgroundStats.remaining}
              </span>
              {backgroundStats.failed > 0 && (
                <span className="text-red-400">Failed: {backgroundStats.failed}</span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStopBackgroundTranslate}
            className="border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/20 hover:text-white"
          >
            Stop
          </Button>
        </div>
      )}
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

      {/* ═══ IMPORT FROM BALADI (run locally) ═══ */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-violet-500/20 p-3">
            <Link2 className="size-6 text-violet-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Import from Baladi</h2>
            <p className="text-sm text-slate-400">
              Enter category numbers and run locally. Import requires Playwright—it cannot run on Vercel.
            </p>
          </div>
        </div>

        <details className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50" open>
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 hover:text-white">
            Instructions
          </summary>
          <ol className="list-decimal list-inside space-y-2 px-4 pb-4 text-sm text-slate-400">
            <li>Enter Baladi category numbers (e.g. 95818, 79673). From URL: .../categories/95818/products</li>
            <li>Select market category (grocery, bakery, retail, etc.)</li>
            <li>Click <strong className="text-white">Run</strong> — the command is copied to your clipboard</li>
            <li>Press <kbd className="rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Ctrl+`</kbd> or <kbd className="rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Cmd+`</kbd> to open the terminal, then <kbd className="rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Ctrl+V</kbd> / <kbd className="rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Cmd+V</kbd> to paste and <kbd className="rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Enter</kbd> to run</li>
            <li>A browser window opens—solve Cloudflare check if shown, then press Enter in the terminal</li>
            <li>When done, refresh this page to see the new products</li>
          </ol>
        </details>

        <form onSubmit={handleCopyImportCommand} className="flex flex-col sm:flex-row flex-wrap items-end gap-4 max-w-2xl">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">Category numbers</label>
            <Input
              value={categoryIdsInput}
              onChange={(e) => setCategoryIdsInput(e.target.value)}
              placeholder="95818, 95010, 95817"
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
          <Button type="submit" disabled={!getImportCommand()} className="bg-violet-600 hover:bg-violet-500">
            {importResult?.ok ? <CheckCircle className="mr-2 size-4" /> : null}
            {importResult?.ok ? 'Copied' : 'Run'}
          </Button>
        </form>
        {getImportCommand() && (
          <div className="mt-4 rounded-lg bg-slate-800/80 px-3 py-2">
            <p className="text-xs text-slate-500 mb-1">Command (copied when you click Run):</p>
            <code className="block font-mono text-sm text-slate-200 break-all select-all">
              {getImportCommand()}
            </code>
          </div>
        )}
        {importResult && (
          <div className={`mt-4 flex items-center gap-2 rounded-lg p-4 ${importResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {importResult.ok && <CheckCircle className="size-5 shrink-0" />}
            <span>{importResult.message}</span>
          </div>
        )}
      </div>

      {/* ═══ IMPORT FROM TALABAT (create full business) ═══ */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-amber-500/20 p-3">
            <Link2 className="size-6 text-amber-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Import from Talabat (Jordan)</h2>
            <p className="text-sm text-slate-400">
              Paste a Talabat restaurant URL and run locally. Opens visible Chrome (like Baladi)—scroll the menu, press Enter to scrape. Creates business with products. Country: Palestine, City: Bethany, owner: burhank@gmail.com, JOD→ILS.
            </p>
          </div>
        </div>
        <details className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50" open>
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 hover:text-white">
            Instructions
          </summary>
          <ol className="list-decimal list-inside space-y-2 px-4 pb-4 text-sm text-slate-400">
            <li>Paste a Talabat restaurant URL (e.g. https://www.talabat.com/ar/jordan/restaurant/646801/al-dayaa)</li>
            <li>Click <strong className="text-white">Run</strong> — the command is copied to your clipboard</li>
            <li>Open the terminal, paste and run. Chrome opens (like Baladi). Scroll the menu to load items, then press Enter in the terminal.</li>
            <li>Creates business with logo, name, categories, products. Country: Palestine, city: Bethany.</li>
          </ol>
        </details>
        <form onSubmit={handleCopyTalabatCommand} className="flex flex-col sm:flex-row flex-wrap items-end gap-4 max-w-2xl">
          <div className="flex-1 min-w-[280px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">Talabat restaurant URL</label>
            <Input
              value={talabatUrl}
              onChange={(e) => setTalabatUrl(e.target.value)}
              placeholder="https://www.talabat.com/jordan/restaurant/646801/al-dayaa"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <Button type="submit" disabled={!getTalabatCommand()} className="bg-amber-600 hover:bg-amber-500">
            {talabatResult?.ok ? <CheckCircle className="mr-2 size-4" /> : null}
            {talabatResult?.ok ? 'Copied' : 'Run'}
          </Button>
        </form>
        {getTalabatCommand() && (
          <div className="mt-4 rounded-lg bg-slate-800/80 px-3 py-2">
            <p className="text-xs text-slate-500 mb-1">Command (copied when you click Run):</p>
            <code className="block font-mono text-sm text-slate-200 break-all select-all">
              {getTalabatCommand()}
            </code>
          </div>
        )}
        {talabatResult && (
          <div className={`mt-4 flex items-center gap-2 rounded-lg p-4 ${talabatResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {talabatResult.ok && <CheckCircle className="size-5 shrink-0" />}
            <span>{talabatResult.message}</span>
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
              Uses OpenAI to translate titles/descriptions (EN↔AR), including Hebrew to English/Arabic. Generates missing descriptions from product names and Levantine Arabic. Run a batch of 50, or translate all in background (processes 100 per batch, continues with new products until all are done—you can keep using the page).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleBackgroundTranslate()}
            disabled={translating || backgroundTranslating}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {backgroundTranslating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
            {backgroundTranslating ? 'Translating…' : 'Translate all (background)'}
          </Button>
          <Button
            onClick={() => handleTranslate(false)}
            disabled={translating || backgroundTranslating}
            className="bg-sky-600 hover:bg-sky-500 text-white"
          >
            {translating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Languages className="mr-2 size-4" />}
            {translating ? 'Translating…' : 'Translate batch (50)'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleTranslate(true)}
            disabled={translating || backgroundTranslating}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            {translating || backgroundTranslating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Dry run (preview)
          </Button>
          <Button
            variant="outline"
            onClick={handleFindDuplicates}
            disabled={findingDuplicates}
            className="border-amber-600/60 text-amber-400 hover:bg-amber-500/10"
          >
            {findingDuplicates ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Copy className="mr-2 size-4" />}
            {findingDuplicates ? 'Finding…' : 'Find Duplicates'}
          </Button>
        </div>
        {(translating || backgroundTranslating) && translateProgress.length > 0 && (
          <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/80 p-3 space-y-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Translating…</p>
            {[...translateProgress].sort((a, b) => a.index - b.index).map((p) => (
              <div
                key={p._id}
                className="flex flex-col gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{p.index}/{p.total}</span>
                  {p.ok === true ? (
                    <CheckCircle className="size-4 text-emerald-400 shrink-0" />
                  ) : p.ok === false ? (
                    <span className="text-red-400 text-xs">Failed</span>
                  ) : (
                    <Loader2 className="size-4 animate-spin text-sky-400 shrink-0" />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300">
                  <span>EN: {p.nameEn || '—'}</span>
                  <span dir="rtl">AR: {p.nameAr || '—'}</span>
                </div>
                {(p.translatedNameEn || p.translatedNameAr) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-emerald-400/90 text-xs">
                    {p.translatedNameEn && <span>→ {p.translatedNameEn}</span>}
                    {p.translatedNameAr && <span dir="rtl">→ {p.translatedNameAr}</span>}
                  </div>
                )}
                {p.error && <p className="text-xs text-red-400 truncate">{p.error}</p>}
              </div>
            ))}
          </div>
        )}
        {translateResult && (
          <div
            className={`mt-4 flex flex-col gap-4 rounded-lg p-4 ${
              translateResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/80 border border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {translateResult.ok && <CheckCircle className="size-5 shrink-0 text-emerald-400" />}
              <span className={translateResult.ok ? 'text-emerald-400' : 'text-slate-200'}>{translateResult.message}</span>
            </div>
            {!translateResult.dryRun && translateResult.totalNeedingWork != null && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col rounded-lg bg-slate-800/60 px-4 py-3 border border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Translated</span>
                  <span className="text-lg font-semibold text-emerald-400">{translateResult.translated ?? 0}</span>
                </div>
                <div className="flex flex-col rounded-lg bg-slate-800/60 px-4 py-3 border border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Skipped</span>
                  <span className="text-lg font-semibold text-slate-300">{translateResult.skipped ?? 0}</span>
                </div>
                <div className="flex flex-col rounded-lg bg-slate-800/60 px-4 py-3 border border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Failed</span>
                  <span className="text-lg font-semibold text-red-400">{translateResult.failed ?? 0}</span>
                </div>
                <div className="flex flex-col rounded-lg bg-slate-800/60 px-4 py-3 border border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Remaining</span>
                  <span className="text-lg font-semibold text-amber-400">{translateResult.remaining ?? translateResult.totalNeedingWork}</span>
                </div>
              </div>
            )}
            {translateResult.dryRun && (
              <p className="text-sm text-slate-400">
                Would process {translateResult.processed ?? 0} of {translateResult.totalNeedingWork ?? 0} products needing work.
              </p>
            )}
            {(translateResult.remaining ?? 0) > 0 && !translateResult.dryRun && (
              <p className="text-sm text-slate-400">
                Click &quot;Translate & Fill&quot; again to process more products.
              </p>
            )}
            {translateResult.errorSamples && translateResult.errorSamples.length > 0 && (
              <details className="mt-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <summary className="cursor-pointer text-sm font-medium text-red-400">Sample errors</summary>
                <ul className="mt-2 space-y-1 text-xs text-red-300/90">
                  {translateResult.errorSamples.map((err, i) => (
                    <li key={i} className="font-mono break-words">{err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Duplicate groups */}
        {duplicateResult && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg p-4 ${
              duplicateResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {duplicateResult.ok && <CheckCircle className="size-5 shrink-0" />}
            <span>{duplicateResult.message}</span>
          </div>
        )}
        {duplicateGroups.length > 0 && (
          <div className="mt-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-300">Duplicate groups (same name + category)</h3>
            {duplicateGroups
              .filter((g) => !dismissedKeys.has(g.key))
              .map((group) => (
                <div
                  key={group.key}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-amber-400/80">
                      {group.products.length} duplicates · {(group.products[0]?.category ?? '').replace(/^./, (c) => c.toUpperCase())}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLeaveDuplicates(group.key)}
                      className="text-slate-400 hover:text-white"
                    >
                      Leave as is
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.products.map((p) => (
                      <div
                        key={p._id}
                        className="flex items-start gap-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                      >
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-700">
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt="" fill className="object-cover" sizes="96px" unoptimized />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Package className="size-10 text-slate-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-white">{p.nameEn || p.nameAr || '—'}</p>
                          {(p.nameAr || p.nameEn) && (
                            <p className="truncate text-xs text-slate-400" dir="rtl">
                              {p.nameAr || p.nameEn}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleMergeDuplicates(
                                p._id,
                                group.products.filter((x) => x._id !== p._id).map((x) => x._id)
                              )
                            }
                            disabled={!!actingOnDuplicate}
                            className="border-emerald-600/60 text-emerald-400 hover:bg-emerald-500/10"
                          >
                            {actingOnDuplicate === p._id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Merge className="size-3" />
                            )}
                            <span className="hidden sm:inline">Merge</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDuplicate(p._id, group.key)}
                            disabled={!!actingOnDuplicate}
                            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          >
                            {actingOnDuplicate === p._id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3" />
                            )}
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ═══ EXISTING PRODUCTS (paginated, inline editable) ═══ */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="font-semibold text-white mb-4">Master catalog products</h2>
        <p className="text-sm text-slate-400 mb-4">
          {needsTranslationFilter
            ? 'Showing only products that need translations (missing EN/AR names or descriptions, or Arabic has English text). Toggle off to see all.'
            : 'Edit directly below. Scroll down to load more (50 per page). Search finds any product.'}
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={needsTranslationFilter}
              onChange={(e) => {
                setNeedsTranslationFilter(e.target.checked)
              }}
              className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
            />
            <span className="text-sm text-slate-300">Needs translation only</span>
          </label>
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
            {needsTranslationFilter
              ? 'No products need translation. Uncheck &quot;Needs translation only&quot; to see all products.'
              : 'No products yet. Use &quot;Manually add product&quot; above or run &quot;Seed master catalog&quot; below.'}
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
