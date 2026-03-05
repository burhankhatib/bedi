'use client'

import { useState } from 'react'

export function VerifyToggle({
  id,
  verified,
  onSuccess,
}: {
  id: string
  verified: boolean
  onSuccess?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(!!verified)

  const handleToggle = async () => {
    const value = !checked
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/drivers/${id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: value }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to update')
      }
      setChecked(value)
      onSuccess?.()
    } catch {
      setChecked(!!verified)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? 'Verified — click to unverify' : 'Click to verify'}
      disabled={loading}
      onClick={handleToggle}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? 'border-emerald-500/60 bg-emerald-500/30' : 'border-slate-600 bg-slate-700/60'}
      `}
      title={checked ? 'Verified — click to unverify' : 'Click to verify driver'}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform
          ${checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0.5 rtl:-translate-x-0.5'}
        `}
      />
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20 text-xs text-slate-300 backdrop-blur-[1px]">…</span>
      )}
    </button>
  )
}
