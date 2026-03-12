'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Package, CheckCircle } from 'lucide-react'

export default function AdminCatalogPage() {
  const [loading, setLoading] = useState(false)
  const [loadingMaster, setLoadingMaster] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; categoriesCreated?: number; productsCreated?: number; message?: string } | null>(null)
  const [masterResult, setMasterResult] = useState<{ ok: boolean; productsCreated?: number; message?: string } | null>(null)

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
    } catch {
      setMasterResult({ ok: false, message: 'Request failed' })
    } finally {
      setLoadingMaster(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Product Catalog</h1>
      <p className="mt-1 text-sm text-slate-400 sm:text-base">
        Palestinian market product catalog for grocery, supermarket, and greengrocer tenants. Seed categories and products so markets can add them to their menus.
      </p>
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
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
