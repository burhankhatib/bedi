'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'

type Row = Record<string, unknown> & { id: string }

export function WhatsAppPipelineDebugClient() {
  const [errors, setErrors] = useState<Row[]>([])
  const [statuses, setStatuses] = useState<Row[]>([])
  const [notes, setNotes] = useState<{ errors?: string; status?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/whatsapp-pipeline-debug', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        setLoadError(typeof data.error === 'string' ? data.error : 'Failed to load')
        setErrors([])
        setStatuses([])
        setNotes(null)
        return
      }
      setErrors(Array.isArray(data.broadcastDeliveryErrors) ? data.broadcastDeliveryErrors : [])
      setStatuses(Array.isArray(data.whatsappOutboundStatus) ? data.whatsappOutboundStatus : [])
      setNotes(typeof data.notes === 'object' && data.notes ? data.notes : null)
    } catch {
      setLoadError('Network error')
      setErrors([])
      setStatuses([])
      setNotes(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const formatCell = (v: unknown) => {
    if (v == null) return '—'
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }

  const RowTable = ({ rows, emptyHint }: { rows: Row[]; emptyHint: string }) => {
    if (loading && rows.length === 0) {
      return (
        <div className="flex items-center gap-2 py-10 text-slate-400 text-sm">
          <Loader2 className="size-5 animate-spin" />
          Loading…
        </div>
      )
    }
    if (rows.length === 0) {
      return <p className="py-8 text-sm text-slate-500">{emptyHint}</p>
    }
    const keys = Array.from(
      rows.reduce((acc, row) => {
        Object.keys(row).forEach((k) => acc.add(k))
        return acc
      }, new Set<string>())
    ).sort((a, b) => {
      if (a === 'id') return -1
      if (b === 'id') return 1
      return a.localeCompare(b)
    })

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-800/80">
        <table className="min-w-[720px] w-full text-left text-xs">
          <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wide">
            <tr>
              {keys.map((k) => (
                <th key={k} className="px-2 py-2 font-medium whitespace-nowrap">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/20 align-top">
                {keys.map((k) => (
                  <td key={k} className="px-2 py-2 text-slate-300 font-mono break-all max-w-[280px]">
                    {formatCell(row[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400 max-w-3xl">
          Raw Firestore collections written by the WhatsApp webhook:{' '}
          <code className="text-slate-300">broadcastDeliveryErrors</code> (failed outbound) and{' '}
          <code className="text-slate-300">whatsappOutboundStatus</code> (all status callbacks: sent, delivered,
          failed). Use this when Delivery log shows Cloud API accepted but the handset never got the message.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700/80 transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loadError ? <p className="text-sm text-red-400">{loadError}</p> : null}

      {notes?.errors ? (
        <p className="text-xs text-amber-200/90 font-mono break-words">broadcastDeliveryErrors query: {notes.errors}</p>
      ) : null}
      {notes?.status ? (
        <p className="text-xs text-amber-200/90 font-mono break-words">whatsappOutboundStatus query: {notes.status}</p>
      ) : null}

      <section>
        <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
          <span className="rounded-md bg-rose-500/15 text-rose-300 px-2 py-0.5 text-xs font-medium">Errors</span>
          broadcastDeliveryErrors
        </h2>
        <p className="text-xs text-slate-500 mb-3">Webhook writes here when Meta reports outbound failed.</p>
        <RowTable rows={errors} emptyHint="No error documents yet (or collection empty)." />
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
          <span className="rounded-md bg-sky-500/15 text-sky-300 px-2 py-0.5 text-xs font-medium">Status</span>
          whatsappOutboundStatus
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Latest pipeline state per wamid (document id is SHA-256 of wamid). Look for{' '}
          <code className="text-slate-400">status</code>: sent → delivered, or failed + errors.
        </p>
        <RowTable rows={statuses} emptyHint="No status documents yet — confirm webhook subscribes to the messages field." />
      </section>

      <p className="text-xs text-slate-600">
        <Link href="/admin/broadcast?tab=delivery-log" className="text-amber-400/90 hover:text-amber-300">
          ← Back to Broadcast delivery log
        </Link>
      </p>
    </div>
  )
}
