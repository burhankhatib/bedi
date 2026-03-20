'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/ToastProvider'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  SortAsc,
  Loader2,
  Layers,
} from 'lucide-react'

type CategoryRow = {
  _id: string
  value: string
  name_en: string
  name_ar: string
  sortOrder?: number
  imageAssetRef?: string | null
}

type SubRow = {
  _id: string
  slug: string
  title_en: string
  title_ar: string
  businessType: string
  sortOrder?: number
}

type TaxonomyResponse = {
  categories: CategoryRow[]
  subcategories: SubRow[]
  tenantCountByType: Record<string, number>
}

async function apiPost(body: Record<string, unknown>) {
  const res = await fetch('/api/admin/business-taxonomy', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

export function AdminBusinessTaxonomyClient() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<TaxonomyResponse | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/business-taxonomy', { credentials: 'include', cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showToast(typeof json?.error === 'string' ? json.error : 'Failed to load', undefined, 'error')
        setData(null)
        return
      }
      setData(json as TaxonomyResponse)
    } catch {
      showToast('Network error', undefined, 'error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const subsFor = (value: string) =>
    (data?.subcategories ?? []).filter((s) => s.businessType === value).sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      if (so !== 0) return so
      return (a.title_en || '').localeCompare(b.title_en || '')
    })

  const reorderCategories = async (orderedIds: string[]) => {
    setBusy(true)
    const { res, data: d } = await apiPost({ action: 'reorderCategories', orderedIds })
    setBusy(false)
    if (!res.ok) {
      showToast(typeof d?.error === 'string' ? d.error : 'Reorder failed', undefined, 'error')
      return
    }
    await load()
  }

  const moveCategory = (index: number, dir: -1 | 1) => {
    const cats = [...(data?.categories ?? [])].sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      if (so !== 0) return so
      return (a.name_en || '').localeCompare(b.name_en || '')
    })
    const j = index + dir
    if (j < 0 || j >= cats.length) return
    const next = [...cats]
    ;[next[index], next[j]] = [next[j], next[index]]
    void reorderCategories(next.map((c) => c._id))
  }

  const sortCategoriesAz = async () => {
    setBusy(true)
    const { res, data: d } = await apiPost({ action: 'sortCategoriesAlphabetical' })
    setBusy(false)
    if (!res.ok) {
      showToast(typeof d?.error === 'string' ? d.error : 'Failed', undefined, 'error')
      return
    }
    showToast(`Sorted ${d.count ?? 0} categories`, undefined, 'success')
    await load()
  }

  const reorderSubs = async (businessType: string, orderedIds: string[]) => {
    setBusy(true)
    const { res, data: d } = await apiPost({ action: 'reorderSubcategories', businessType, orderedIds })
    setBusy(false)
    if (!res.ok) {
      showToast(typeof d?.error === 'string' ? d.error : 'Reorder failed', undefined, 'error')
      return
    }
    await load()
  }

  const moveSub = (businessType: string, subs: SubRow[], index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= subs.length) return
    const next = [...subs]
    ;[next[index], next[j]] = [next[j], next[index]]
    void reorderSubs(
      businessType,
      next.map((s) => s._id)
    )
  }

  const sortSubsAz = async (businessType: string) => {
    setBusy(true)
    const { res, data: d } = await apiPost({ action: 'sortSubcategoriesAlphabetical', businessType })
    setBusy(false)
    if (!res.ok) {
      showToast(typeof d?.error === 'string' ? d.error : 'Failed', undefined, 'error')
      return
    }
    showToast(`Sorted ${d.count ?? 0} sub-categories`, undefined, 'success')
    await load()
  }

  /* —— dialogs —— */
  const [catDialog, setCatDialog] = useState<'add' | 'edit' | null>(null)
  const [catForm, setCatForm] = useState({ value: '', name_en: '', name_ar: '', id: '' as string, imageAssetRef: '' })

  const [delCat, setDelCat] = useState<CategoryRow | null>(null)
  const [delCatConfirm, setDelCatConfirm] = useState('')

  const [subDialog, setSubDialog] = useState<'add' | 'edit' | null>(null)
  const [subForm, setSubForm] = useState({
    id: '',
    businessType: '',
    slug: '',
    title_en: '',
    title_ar: '',
    sortOrder: 0,
  })

  const [delSub, setDelSub] = useState<SubRow | null>(null)

  const uploadImage = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'include' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Upload failed')
    return String(j._id)
  }

  const saveCategory = async () => {
    setBusy(true)
    if (catDialog === 'add') {
      const { res, data: d } = await apiPost({
        action: 'createCategory',
        value: catForm.value,
        name_en: catForm.name_en,
        name_ar: catForm.name_ar,
        ...(catForm.imageAssetRef.trim() ? { imageAssetRef: catForm.imageAssetRef.trim() } : {}),
      })
      setBusy(false)
      if (!res.ok) {
        showToast(typeof d?.error === 'string' ? d.error : 'Failed', undefined, 'error')
        return
      }
      showToast('Category created', undefined, 'success')
    } else if (catDialog === 'edit' && catForm.id) {
      const { res, data: d } = await apiPost({
        action: 'updateCategory',
        id: catForm.id,
        value: catForm.value,
        name_en: catForm.name_en,
        name_ar: catForm.name_ar,
        ...(catForm.imageAssetRef.trim() ? { imageAssetRef: catForm.imageAssetRef.trim() } : {}),
      })
      setBusy(false)
      if (!res.ok) {
        showToast(typeof d?.error === 'string' ? d.error : 'Failed', undefined, 'error')
        return
      }
      showToast('Category updated', undefined, 'success')
    }
    setCatDialog(null)
    await load()
  }

  const confirmDeleteCategory = async () => {
    if (!delCat) return
    setBusy(true)
    const { res, data: d } = await apiPost({
      action: 'deleteCategory',
      id: delCat._id,
      confirmValue: delCatConfirm.trim(),
    })
    setBusy(false)
    if (!res.ok) {
      showToast(typeof d?.error === 'string' ? d.error : 'Delete failed', undefined, 'error')
      return
    }
    showToast(`Deleted (and ${d.deletedSubcategories ?? 0} sub-categories)`, undefined, 'success')
    setDelCat(null)
    setDelCatConfirm('')
    await load()
  }

  const saveSub = async () => {
    setBusy(true)
    if (subDialog === 'add') {
      const { res, data: d } = await apiPost({
        action: 'createSubcategory',
        businessType: subForm.businessType,
        title_en: subForm.title_en,
        title_ar: subForm.title_ar,
        ...(subForm.slug.trim() ? { slug: subForm.slug.trim() } : {}),
      })
      setBusy(false)
      if (!res.ok) {
        showToast(typeof d?.error === 'string' ? d.error : 'Failed', undefined, 'error')
        return
      }
      showToast('Sub-category created', undefined, 'success')
    } else if (subDialog === 'edit' && subForm.id) {
      const { res, data: d } = await apiPost({
        action: 'updateSubcategory',
        id: subForm.id,
        title_en: subForm.title_en,
        title_ar: subForm.title_ar,
        sortOrder: subForm.sortOrder,
      })
      setBusy(false)
      if (!res.ok) {
        showToast(typeof d?.error === 'string' ? d.error : 'Failed', undefined, 'error')
        return
      }
      showToast('Sub-category updated', undefined, 'success')
    }
    setSubDialog(null)
    await load()
  }

  const confirmDeleteSub = async () => {
    if (!delSub) return
    setBusy(true)
    const { res, data: d } = await apiPost({ action: 'deleteSubcategory', id: delSub._id })
    setBusy(false)
    if (!res.ok) {
      showToast(typeof d?.error === 'string' ? d.error : 'Failed', undefined, 'error')
      return
    }
    showToast(`Deleted (cleared from ${d.tenantsUpdated ?? 0} businesses)`, undefined, 'success')
    setDelSub(null)
    await load()
  }

  const categoriesSorted = [...(data?.categories ?? [])].sort((a, b) => {
    const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (so !== 0) return so
    return (a.name_en || '').localeCompare(b.name_en || '')
  })

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
        Loading taxonomy…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Business taxonomy</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Categories are business types (restaurant, grocery, pharmacy...). To add cuisines/specialties like Italian or
            Burgers, expand a category and use Add under Sub-categories. Edits apply everywhere; deleting a sub-category
            removes it from all businesses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-slate-600 bg-slate-900 text-slate-200"
            disabled={busy}
            onClick={() => load()}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-slate-600 bg-slate-900 text-slate-200"
            disabled={busy}
            onClick={() => void sortCategoriesAz()}
          >
            <SortAsc className="mr-1 size-4" />
            Categories A–Z
          </Button>
          <Button
            type="button"
            className="bg-amber-500 text-slate-950 hover:bg-amber-400"
            disabled={busy}
            onClick={() => {
              setCatForm({ value: '', name_en: '', name_ar: '', id: '', imageAssetRef: '' })
              setCatDialog('add')
            }}
          >
            <Plus className="mr-1 size-4" />
            Add business type
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {categoriesSorted.map((cat, idx) => {
          const subs = subsFor(cat.value)
          const open = expanded.has(cat._id)
          const tc = data?.tenantCountByType?.[cat.value] ?? 0
          return (
            <div key={cat._id} className="rounded-xl border border-slate-800 bg-slate-900/50">
              <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => toggleExpand(cat._id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-white"
                >
                  {open ? <ChevronDown className="size-5 shrink-0 text-slate-400" /> : <ChevronRight className="size-5 shrink-0 text-slate-400" />}
                  <Layers className="size-4 shrink-0 text-amber-400/80" />
                  <span className="font-medium truncate">{cat.name_en}</span>
                  <code className="hidden rounded bg-slate-800 px-1.5 py-0.5 text-xs text-amber-200/90 sm:inline">{cat.value}</code>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                    {tc} business{tc === 1 ? '' : 'es'}
                  </span>
                  <span className="text-xs text-slate-500">{subs.length} sub</span>
                </button>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-slate-400 hover:text-white"
                    disabled={busy || idx === 0}
                    onClick={() => moveCategory(idx, -1)}
                    aria-label="Move up"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-slate-400 hover:text-white"
                    disabled={busy || idx >= categoriesSorted.length - 1}
                    onClick={() => moveCategory(idx, 1)}
                    aria-label="Move down"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-slate-300"
                    disabled={busy}
                    onClick={() => {
                      setCatForm({
                        id: cat._id,
                        value: cat.value,
                        name_en: cat.name_en,
                        name_ar: cat.name_ar,
                        imageAssetRef: cat.imageAssetRef ?? '',
                      })
                      setCatDialog('edit')
                    }}
                  >
                    <Pencil className="mr-1 size-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    disabled={busy}
                    onClick={() => {
                      setDelCat(cat)
                      setDelCatConfirm('')
                    }}
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
              {open && (
                <div className="border-t border-slate-800 px-3 pb-3 sm:px-4">
                  <div className="mb-2 mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Sub-categories</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-slate-600 text-xs"
                      disabled={busy}
                      onClick={() => void sortSubsAz(cat.value)}
                    >
                      A–Z order
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 bg-amber-500/90 px-2 text-xs text-slate-950 hover:bg-amber-400"
                      disabled={busy}
                      onClick={() => {
                        setSubForm({
                          id: '',
                          businessType: cat.value,
                          slug: '',
                          title_en: '',
                          title_ar: '',
                          sortOrder: subs.length,
                        })
                        setSubDialog('add')
                      }}
                    >
                      <Plus className="mr-1 size-3" />
                      Add
                    </Button>
                  </div>
                  {subs.length === 0 ? (
                    <p className="text-sm text-slate-500">No sub-categories yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {subs.map((s, si) => (
                        <li
                          key={s._id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2 py-2 text-sm"
                        >
                          <span className="min-w-0 flex-1 font-medium text-slate-200">{s.title_en}</span>
                          <code className="text-xs text-slate-500">{s.slug}</code>
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7 text-slate-400"
                              disabled={busy || si === 0}
                              onClick={() => moveSub(cat.value, subs, si, -1)}
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7 text-slate-400"
                              disabled={busy || si >= subs.length - 1}
                              onClick={() => moveSub(cat.value, subs, si, 1)}
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-slate-300"
                              disabled={busy}
                              onClick={() => {
                                setSubForm({
                                  id: s._id,
                                  businessType: s.businessType,
                                  slug: s.slug,
                                  title_en: s.title_en,
                                  title_ar: s.title_ar,
                                  sortOrder: s.sortOrder ?? si,
                                })
                                setSubDialog('edit')
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-red-400"
                              disabled={busy}
                              onClick={() => setDelSub(s)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Category dialog */}
      <Dialog open={catDialog !== null} onOpenChange={(o) => !o && setCatDialog(null)}>
        <DialogContent className="border-slate-700 bg-slate-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{catDialog === 'add' ? 'Add business category' : 'Edit business category'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Machine id must stay unique. Tenants and homepage use names for display.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Machine id (e.g. juice_bar)</label>
              <Input
                value={catForm.value}
                onChange={(e) => setCatForm((f) => ({ ...f, value: e.target.value }))}
                className="border-slate-600 bg-slate-800 font-mono text-white"
                disabled={catDialog === 'edit'}
                placeholder="restaurant"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Name (EN)</label>
              <Input
                value={catForm.name_en}
                onChange={(e) => setCatForm((f) => ({ ...f, name_en: e.target.value }))}
                className="border-slate-600 bg-slate-800 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Name (AR)</label>
              <Input
                value={catForm.name_ar}
                onChange={(e) => setCatForm((f) => ({ ...f, name_ar: e.target.value }))}
                className="border-slate-600 bg-slate-800 text-white"
              />
            </div>
            {catDialog === 'add' && (
              <div>
                <label className="mb-1 block text-xs text-slate-400">Image (optional)</label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="border-slate-600 text-slate-300"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      const id = await uploadImage(f)
                      setCatForm((prev) => ({ ...prev, imageAssetRef: id }))
                      showToast('Image uploaded', undefined, 'success')
                    } catch (err) {
                      showToast((err as Error).message, undefined, 'error')
                    }
                  }}
                />
                {catForm.imageAssetRef ? (
                  <p className="mt-1 text-xs text-emerald-400">Asset ready — will attach on save.</p>
                ) : null}
              </div>
            )}
            {catDialog === 'edit' && (
              <div>
                <label className="mb-1 block text-xs text-slate-400">Replace image</label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="border-slate-600 text-slate-300"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      const id = await uploadImage(f)
                      setCatForm((prev) => ({ ...prev, imageAssetRef: id }))
                      showToast('Image uploaded — save to apply', undefined, 'success')
                    } catch (err) {
                      showToast((err as Error).message, undefined, 'error')
                    }
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-slate-600" onClick={() => setCatDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
              disabled={busy || !catForm.value.trim() || !catForm.name_en.trim() || !catForm.name_ar.trim()}
              onClick={() => void saveCategory()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete category */}
      <Dialog open={delCat !== null} onOpenChange={(o) => !o && setDelCat(null)}>
        <DialogContent className="border-slate-700 bg-slate-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete business category</DialogTitle>
            <DialogDescription className="text-slate-400">
              Deletes all sub-categories of this type and removes their links from businesses. Only allowed when no business uses
              this machine id.
            </DialogDescription>
          </DialogHeader>
          {delCat && (
            <p className="text-sm text-slate-300">
              Type <code className="rounded bg-slate-800 px-1">{delCat.value}</code> to confirm.
            </p>
          )}
          <Input
            value={delCatConfirm}
            onChange={(e) => setDelCatConfirm(e.target.value)}
            className="border-slate-600 bg-slate-800 font-mono text-white"
            placeholder="machine id"
          />
          <DialogFooter>
            <Button type="button" variant="outline" className="border-slate-600" onClick={() => setDelCat(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !delCat || delCatConfirm.trim() !== delCat.value}
              onClick={() => void confirmDeleteCategory()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub dialog */}
      <Dialog open={subDialog !== null} onOpenChange={(o) => !o && setSubDialog(null)}>
        <DialogContent className="border-slate-700 bg-slate-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{subDialog === 'add' ? 'Add sub-category' : 'Edit sub-category'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {subDialog === 'edit'
                ? 'Slug and business type are fixed. Delete and recreate to move.'
                : 'Slug is generated from the English title unless you override.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {subDialog === 'add' && (
              <div>
                <label className="mb-1 block text-xs text-slate-400">Business type (machine id)</label>
                <Input
                  value={subForm.businessType}
                  onChange={(e) => setSubForm((f) => ({ ...f, businessType: e.target.value }))}
                  className="border-slate-600 bg-slate-800 font-mono text-white"
                />
              </div>
            )}
            {subDialog === 'add' && (
              <div>
                <label className="mb-1 block text-xs text-slate-400">Slug override (optional)</label>
                <Input
                  value={subForm.slug}
                  onChange={(e) => setSubForm((f) => ({ ...f, slug: e.target.value }))}
                  className="border-slate-600 bg-slate-800 font-mono text-white"
                  placeholder="auto from English title"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-slate-400">Title (EN)</label>
              <Input
                value={subForm.title_en}
                onChange={(e) => setSubForm((f) => ({ ...f, title_en: e.target.value }))}
                className="border-slate-600 bg-slate-800 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Title (AR)</label>
              <Input
                value={subForm.title_ar}
                onChange={(e) => setSubForm((f) => ({ ...f, title_ar: e.target.value }))}
                className="border-slate-600 bg-slate-800 text-white"
              />
            </div>
            {subDialog === 'edit' && (
              <div>
                <label className="mb-1 block text-xs text-slate-400">Sort order</label>
                <Input
                  type="number"
                  value={subForm.sortOrder}
                  onChange={(e) => setSubForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="border-slate-600 bg-slate-800 text-white"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-slate-600" onClick={() => setSubDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
              disabled={
                busy ||
                !subForm.title_en.trim() ||
                !subForm.title_ar.trim() ||
                (subDialog === 'add' && !subForm.businessType.trim())
              }
              onClick={() => void saveSub()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete sub */}
      <Dialog open={delSub !== null} onOpenChange={(o) => !o && setDelSub(null)}>
        <DialogContent className="border-slate-700 bg-slate-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete sub-category</DialogTitle>
            <DialogDescription className="text-slate-400">
              Removes this specialty from every business that selected it, then deletes the document.
            </DialogDescription>
          </DialogHeader>
          {delSub && <p className="text-slate-200">{delSub.title_en}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="border-slate-600" onClick={() => setDelSub(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmDeleteSub()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
