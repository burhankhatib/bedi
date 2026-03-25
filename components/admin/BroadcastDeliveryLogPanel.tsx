'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Loader2, RefreshCw } from 'lucide-react'

type DeliveryLogRow = {
  id: string
  jobId: string
  createdAt: string
  createdAtMs: number
  channel: string
  status: string
  recipientName: string
  recipientPhone: string
  clerkUserId?: string
  role?: string
  country?: string
  city?: string
  messagePreview?: string
  error?: string
  providerMessageId?: string
  broadcastCountries?: string
  broadcastCities?: string
  pushRoleContext?: string
}

const CHANNEL_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'fcm', label: 'FCM' },
  { value: 'web_push', label: 'Web Push' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
]

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'business', label: 'Business' },
  { value: 'driver', label: 'Driver' },
  { value: 'customer', label: 'Customer' },
  { value: 'specific', label: 'Specific' },
]

export function BroadcastDeliveryLogPanel() {
  const [rows, setRows] = useState<DeliveryLogRow[]>([])
  const [scanned, setScanned] = useState(0)
  const [hint, setHint] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [jobId, setJobId] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(150)

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('limit', String(Math.min(400, Math.max(20, limit))))
    if (channel) p.set('channel', channel)
    if (status) p.set('status', status)
    if (role) p.set('role', role)
    if (country.trim()) p.set('country', country.trim())
    if (city.trim()) p.set('city', city.trim())
    if (jobId.trim()) p.set('jobId', jobId.trim())
    if (q.trim()) p.set('q', q.trim())
    return p.toString()
  }, [channel, status, role, country, city, jobId, q, limit])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/broadcast-delivery-logs?${queryString}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to load')
        setRows([])
        return
      }
      setRows(Array.isArray(data.rows) ? data.rows : [])
      setScanned(typeof data.scanned === 'number' ? data.scanned : 0)
      setHint(typeof data.hint === 'string' ? data.hint : undefined)
    } catch {
      setError('Network error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    const t = setTimeout(() => {
      void load()
    }, 300)
    return () => clearTimeout(t)
  }, [load])

  const channelBadge = (c: string) => {
    if (c === 'whatsapp') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    if (c === 'fcm') return 'bg-sky-500/20 text-sky-300 border-sky-500/30'
    if (c === 'web_push') return 'bg-violet-500/20 text-violet-300 border-violet-500/30'
    return 'bg-slate-700 text-slate-300 border-slate-600'
  }

  const statusBadge = (s: string) => {
    if (s === 'success') return 'bg-emerald-600/25 text-emerald-200 border-emerald-500/40'
    if (s === 'failed') return 'bg-red-600/25 text-red-200 border-red-500/40'
    if (s === 'skipped') return 'bg-amber-600/20 text-amber-200 border-amber-500/35'
    return 'bg-slate-700 text-slate-300 border-slate-600'
  }

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2.5">
            <ClipboardList className="size-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Broadcast delivery log</h2>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              Each row is one send attempt from an admin mass broadcast: WhatsApp template, FCM, or Web Push.
              Filters apply to the most recent events loaded from the server (scan cap applies).
            </p>
            {hint ? <p className="mt-2 text-xs text-amber-200/80">{hint}</p> : null}
            <p className="mt-1 text-xs text-slate-500">Last scan: {scanned} raw rows · showing {rows.length} after filters</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Channel
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            {CHANNEL_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all-s'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value || 'all-r'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Country contains
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. ps"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          City contains
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. ramallah"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400 sm:col-span-2">
          Broadcast job ID
          <input
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="UUID from job response"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white font-mono placeholder:text-slate-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400 sm:col-span-2">
          Search name / phone / Clerk ID
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Substring match"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Max rows
          <select
            value={String(limit)}
            onChange={(e) => setLimit(parseInt(e.target.value, 10) || 150)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="150">150</option>
            <option value="200">200</option>
            <option value="300">300</option>
            <option value="400">400</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800/80">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="bg-slate-800/50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3 font-medium">Time (UTC)</th>
              <th className="px-3 py-3 font-medium">Channel</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Recipient</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Location</th>
              <th className="px-3 py-3 font-medium">Message</th>
              <th className="px-3 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-slate-400">
                  <Loader2 className="size-6 animate-spin inline-block mr-2 align-middle" />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  No rows match your filters (or no broadcasts have been processed since logging was enabled).
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap align-top">
                    {new Date(r.createdAtMs).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs ${channelBadge(r.channel)}`}>
                      {r.channel || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs ${statusBadge(r.status)}`}>
                      {r.status || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 align-top text-slate-200">
                    <div className="font-medium">{r.recipientName || '—'}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                      {r.recipientPhone || '—'}
                    </div>
                    {r.clerkUserId ? (
                      <div className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-[200px]" title={r.clerkUserId}>
                        {r.clerkUserId}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 align-top capitalize">{r.role || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs align-top">
                    <div>{r.country || '—'}</div>
                    <div className="text-slate-500">{r.city || '—'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs align-top max-w-[220px]">
                    <span className="line-clamp-3">{r.messagePreview || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs align-top text-slate-400 max-w-[280px]">
                    {r.providerMessageId ? (
                      <div className="text-emerald-400/90 font-mono break-all" title="WhatsApp / Meta message id">
                        {r.providerMessageId}
                      </div>
                    ) : null}
                    {r.pushRoleContext ? <div className="text-slate-500 mt-1">Push context: {r.pushRoleContext}</div> : null}
                    {r.error ? <div className="text-red-300/90 mt-1 break-words">{r.error}</div> : null}
                    <div className="text-slate-600 mt-1 font-mono text-[10px] break-all">job {r.jobId}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
