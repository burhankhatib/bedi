'use client'

import { useState, useEffect } from 'react'
import { MapPin, Loader2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type AreaRow = {
  _id: string
  name_en: string | null
  name_ar: string | null
  deliveryPrice: number
  currency: string
  isActive: boolean
  siteRef: string
  tenantName: string | null
  tenantSlug: string | null
  city: string | null
  country: string | null
}

export function AdminAreasClient() {
  const [areas, setAreas] = useState<AreaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cityFilter, setCityFilter] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEn, setEditEn] = useState('')
  const [editAr, setEditAr] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAreas = () => {
    const params = new URLSearchParams()
    if (cityFilter) params.set('city', cityFilter)
    if (tenantFilter) params.set('tenant', tenantFilter)
    fetch(`/api/admin/areas?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setAreas(Array.isArray(data) ? data : []))
      .catch(() => setAreas([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    fetchAreas()
  }, [cityFilter, tenantFilter])

  const startEdit = (a: AreaRow) => {
    setEditingId(a._id)
    setEditEn(a.name_en ?? '')
    setEditAr(a.name_ar ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditEn('')
    setEditAr('')
  }

  const saveEdit = async () => {
    if (!editingId) return
    const name_en = editEn.trim()
    const name_ar = editAr.trim()
    if (!name_en && !name_ar) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/areas/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(name_en.length > 0 && { name_en }),
          ...(name_ar.length > 0 && { name_ar }),
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setAreas((prev) =>
          prev.map((x) =>
            x._id === editingId
              ? { ...x, name_en: data.name_en ?? x.name_en, name_ar: data.name_ar ?? x.name_ar }
              : x
          )
        )
        cancelEdit()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filter by city"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-700 bg-slate-800/80 px-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
        <input
          type="text"
          placeholder="Filter by business name or slug"
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-700 bg-slate-800/80 px-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
      </div>

      {areas.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-12 text-center">
          <MapPin className="mx-auto size-12 text-slate-600" />
          <p className="mt-4 text-slate-400">No delivery areas found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-400">
                  <th className="px-4 py-3 font-medium md:px-6">Business</th>
                  <th className="px-4 py-3 font-medium md:px-6">City / Country</th>
                  <th className="px-4 py-3 font-medium md:px-6">Name (EN)</th>
                  <th className="px-4 py-3 font-medium md:px-6">Name (AR)</th>
                  <th className="px-4 py-3 font-medium md:px-6">Price</th>
                  <th className="px-4 py-3 font-medium md:px-6 w-24 text-right">Edit</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a._id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                    <td className="px-4 py-3 md:px-6">
                      <span className="font-medium">{a.tenantName ?? a.tenantSlug ?? '—'}</span>
                      {a.tenantSlug && (
                        <span className="ml-1 text-slate-500">/{a.tenantSlug}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 md:px-6 text-slate-400">
                      {[a.city, a.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    {editingId === a._id ? (
                      <>
                        <td className="px-4 py-2 md:px-6">
                          <Input
                            value={editEn}
                            onChange={(e) => setEditEn(e.target.value)}
                            className="h-9 bg-slate-800 border-slate-600 text-white"
                            placeholder="Name (EN)"
                          />
                        </td>
                        <td className="px-4 py-2 md:px-6">
                          <Input
                            value={editAr}
                            onChange={(e) => setEditAr(e.target.value)}
                            className="h-9 bg-slate-800 border-slate-600 text-white"
                            placeholder="Name (AR)"
                          />
                        </td>
                        <td className="px-4 py-3 md:px-6 text-slate-400" />
                        <td className="px-4 py-2 md:px-6 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-9 text-emerald-400 hover:bg-emerald-500/20"
                            onClick={saveEdit}
                            disabled={saving || (!editEn.trim() && !editAr.trim())}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-9 text-slate-400 hover:bg-slate-700"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            <X className="size-4" />
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 md:px-6">{a.name_en ?? '—'}</td>
                        <td className="px-4 py-3 md:px-6 font-arabic text-slate-300">{a.name_ar ?? '—'}</td>
                        <td className="px-4 py-3 md:px-6 text-slate-400">
                          {a.deliveryPrice === 0 ? 'Free' : `${a.deliveryPrice} ${a.currency ?? ''}`}
                        </td>
                        <td className="px-4 py-3 md:px-6 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-9 text-amber-400 hover:bg-amber-500/20"
                            onClick={() => startEdit(a)}
                            aria-label="Edit area names"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
