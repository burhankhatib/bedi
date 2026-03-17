'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Zap, CheckCircle, AlertCircle } from 'lucide-react'

export default function SeedSubcategoriesPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; created?: number; failed?: number; message?: string; error?: string } | null>(null)

  const handleSeed = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/seed-subcategories', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setResult({ ok: true, created: data.created, failed: data.failed, message: data.message })
      } else {
        setResult({ ok: false, error: data.error || 'Failed' })
      }
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Seed Business Subcategories</h1>
      <p className="text-slate-400 max-w-xl">
        Creates or updates all business sub-categories (Italian, Mexican, Japanese, etc.) in Sanity. Uses the app&apos;s Sanity project, so data appears immediately in /manage/business.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button
          onClick={handleSeed}
          disabled={loading}
          className="bg-amber-500 text-slate-950 hover:bg-amber-400"
        >
          {loading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Seeding…
            </>
          ) : (
            <>
              <Zap className="mr-2 size-4" />
              Seed subcategories
            </>
          )}
        </Button>
      </div>
      {result && (
        <div className={`rounded-xl border p-4 ${result.ok ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
          {result.ok ? (
            <>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="size-5" />
                <span className="font-semibold">Done</span>
              </div>
              <p className="mt-2 text-slate-300">{result.message}</p>
              <p className="mt-1 text-sm text-slate-400">
                Refresh your business profile page (/manage/business) to see all subcategories.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="size-5" />
                <span className="font-semibold">Error</span>
              </div>
              <p className="mt-2 text-slate-300">{result.error}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
