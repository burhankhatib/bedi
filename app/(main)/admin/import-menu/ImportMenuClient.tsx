'use client'

import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Tenant } from '@/lib/tenant'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'

const EXAMPLE_SNIPPET = `{
  "categories": [
    {
      "title_en": "Drinks",
      "title_ar": "مشروبات",
      "sortOrder": 0,
      "products": [
        {
          "title_en": "Coffee",
          "title_ar": "قهوة",
          "price": 12,
          "currency": "ILS",
          "description_en": "Optional",
          "description_ar": "اختياري",
          "imageUrl": "https://example.com/photo.jpg"
        }
      ]
    }
  ]
}`

export function ImportMenuClient({ tenants }: { tenants: Tenant[] }) {
  const [tenantSlug, setTenantSlug] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    ok?: boolean
    categoriesCreated?: number
    productsCreated?: number
    errors?: string[]
    error?: string
  } | null>(null)

  const sorted = [...tenants].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    if (!tenantSlug) {
      setResult({ ok: false, error: 'Select a business' })
      return
    }
    if (!file) {
      setResult({ ok: false, error: 'Choose a JSON file' })
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set('tenantSlug', tenantSlug)
      fd.set('file', file)
      const res = await fetch('/api/admin/import-menu-json', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setResult({
          ok: true,
          categoriesCreated: data.categoriesCreated,
          productsCreated: data.productsCreated,
          errors: Array.isArray(data.errors) ? data.errors : [],
        })
      } else {
        setResult({
          ok: false,
          error: data.error || 'Import failed',
          errors: Array.isArray(data.errors) ? data.errors : [],
        })
      }
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Import menu from JSON</h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Select a business, upload a JSON file with a <code className="rounded bg-slate-800 px-1 text-slate-200">categories</code> array. New
          categories and products are added in Sanity; existing menu items are left as-is.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-w-xl space-y-4">
        <div>
          <label htmlFor="tenant" className="mb-1.5 block text-sm font-medium text-slate-300">
            Business
          </label>
          <select
            id="tenant"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            required
          >
            <option value="">— Choose —</option>
            {sorted.map((t) => (
              <option key={t._id} value={t.slug}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="json" className="mb-1.5 block text-sm font-medium text-slate-300">
            JSON file
          </label>
          <input
            id="json"
            name="file"
            type="file"
            accept="application/json,.json"
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-white file:hover:bg-slate-700"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button type="submit" disabled={loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
          {loading ? (
            <>Importing…</>
          ) : (
            <>
              <Upload className="mr-2 size-4" />
              Import menu
            </>
          )}
        </Button>
      </form>

      {result && (
        <div
          className={`max-w-2xl rounded-xl border p-4 ${
            result.ok ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'
          }`}
        >
          {result.ok ? (
            <>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="size-5" />
                <span className="font-semibold">Import finished</span>
              </div>
              <p className="mt-2 text-slate-300">
                Categories: {result.categoriesCreated ?? 0}, products: {result.productsCreated ?? 0}
              </p>
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-sm text-amber-200/90">
                  {result.errors.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="size-5" />
                <span className="font-semibold">Could not complete import</span>
              </div>
              <p className="mt-2 text-slate-300">{result.error}</p>
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-sm text-slate-400">
                  {result.errors.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div className="max-w-2xl rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Minimal JSON shape</h2>
        <pre className="mt-2 overflow-x-auto text-xs text-slate-400 whitespace-pre-wrap">{EXAMPLE_SNIPPET}</pre>
        <p className="mt-2 text-xs text-slate-500">
          Optional per product: <code className="text-slate-400">description_*</code>, <code className="text-slate-400">addOns</code>,{' '}
          <code className="text-slate-400">variants</code>, <code className="text-slate-400">dietaryTags</code>,{' '}
          <code className="text-slate-400">additionalImageUrls</code> (array of URLs).
        </p>
      </div>
    </div>
  )
}
