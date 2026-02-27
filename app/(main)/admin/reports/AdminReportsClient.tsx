'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileWarning, Loader2, Phone, Archive, Shield, ShieldOff, MessageCircle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCategoryLabel } from '@/lib/report-categories'
import { getWhatsAppUrl } from '@/lib/whatsapp'

type Report = {
  _id: string
  _createdAt: string
  reporterType?: string
  reportedType?: string
  category?: string
  description?: string
  status?: string
  archived?: boolean
  orderNumber?: string
  reportedCustomerInfo?: string
  reporterTenantId?: string
  reporterDriverId?: string
  reportedTenantId?: string
  reportedDriverId?: string
  reporterPhone: string | null
  reportedPhone: string | null
  reportedCustomerId: string | null
  reportedBlocked: boolean
  reporterBlocked: boolean
}

type ReportCounts = {
  tenant: Record<string, number>
  driver: Record<string, number>
  customer: Record<string, number>
}

type SuspendedContact = {
  _id: string
  type: string
  name: string | null
  email: string
  message: string | null
  createdAt: string | null
  resolved: { id: string; phone: string | null; blocked: boolean } | null
}

function getReportedCount(r: Report, counts: ReportCounts): number {
  if (r.reportedType === 'business' && r.reportedTenantId)
    return counts.tenant[r.reportedTenantId] ?? 0
  if (r.reportedType === 'driver' && r.reportedDriverId)
    return counts.driver[r.reportedDriverId] ?? 0
  if (r.reportedType === 'customer') {
    const key = r.reportedCustomerId || r.reportedCustomerInfo || ''
    return key ? (counts.customer[key] ?? 0) : 0
  }
  return 0
}

function getBlockEndpoint(r: Report, isReported: boolean): { url: string; id: string } | null {
  if (isReported) {
    if (r.reportedType === 'business' && r.reportedTenantId)
      return { url: `/api/admin/tenants/${r.reportedTenantId}/block`, id: r.reportedTenantId }
    if (r.reportedType === 'driver' && r.reportedDriverId)
      return { url: `/api/admin/drivers/${r.reportedDriverId}/block`, id: r.reportedDriverId }
    if (r.reportedType === 'customer' && r.reportedCustomerId)
      return { url: `/api/admin/customers/${r.reportedCustomerId}/block`, id: r.reportedCustomerId }
  } else {
    if (r.reporterType === 'business' && r.reporterTenantId)
      return { url: `/api/admin/tenants/${r.reporterTenantId}/block`, id: r.reporterTenantId }
    if (r.reporterType === 'driver' && r.reporterDriverId)
      return { url: `/api/admin/drivers/${r.reporterDriverId}/block`, id: r.reporterDriverId }
  }
  return null
}

function getBlockUrlForContact(type: string, id: string): string | null {
  if (type === 'driver') return `/api/admin/drivers/${id}/block`
  if (type === 'business') return `/api/admin/tenants/${id}/block`
  if (type === 'customer') return `/api/admin/customers/${id}/block`
  return null
}

export function AdminReportsClient() {
  const [reports, setReports] = useState<Report[]>([])
  const [reportCounts, setReportCounts] = useState<ReportCounts>({ tenant: {}, driver: {}, customer: {} })
  const [suspendedContacts, setSuspendedContacts] = useState<SuspendedContact[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const fetchReports = useCallback(() => {
    setLoading(true)
    const q = showArchived ? '?archived=1' : ''
    Promise.all([
      fetch(`/api/admin/reports${q}`, { credentials: 'include' }).then((res) => res.json()),
      fetch('/api/admin/suspended-contacts', { credentials: 'include' }).then((res) => res.json()),
    ])
      .then(([reportsData, contactsData]) => {
        setReports(Array.isArray(reportsData.reports) ? reportsData.reports : [])
        setReportCounts(reportsData.reportCounts ?? { tenant: {}, driver: {}, customer: {} })
        setSuspendedContacts(Array.isArray(contactsData.contacts) ? contactsData.contacts : [])
      })
      .catch(() => {
        setReports([])
        setReportCounts({ tenant: {}, driver: {}, customer: {} })
        setSuspendedContacts([])
      })
      .finally(() => setLoading(false))
  }, [showArchived])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const archiveReport = async (id: string) => {
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ archived: true }),
      })
      if (res.ok) fetchReports()
    } finally {
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  const toggleBlock = async (r: Report, isReported: boolean, currentBlocked: boolean) => {
    const ep = getBlockEndpoint(r, isReported)
    if (!ep) return
    const key = `${ep.id}-${isReported ? 'reported' : 'reporter'}`
    setBusy((b) => ({ ...b, [key]: true }))
    try {
      const res = await fetch(ep.url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blocked: !currentBlocked }),
      })
      if (res.ok) fetchReports()
    } finally {
      setBusy((b) => ({ ...b, [key]: false }))
    }
  }

  const toggleBlockContact = async (c: SuspendedContact, currentBlocked: boolean) => {
    const resolved = c.resolved
    const url = resolved ? getBlockUrlForContact(c.type, resolved.id) : null
    if (!url || !resolved) return
    const key = `contact-${resolved.id}`
    setBusy((b) => ({ ...b, [key]: true }))
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blocked: !currentBlocked }),
      })
      if (res.ok) fetchReports()
    } finally {
      setBusy((b) => ({ ...b, [key]: false }))
    }
  }

  const categoryLabel = (r: Report) => {
    if (!r.category) return '—'
    const key = `${r.reporterType}→${r.reportedType}`
    return getCategoryLabel(r.category, key) || r.category
  }

  if (loading && reports.length === 0) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
        Loading reports…
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-amber-500"
          />
          Show archived (read)
        </label>
      </div>

      {/* Suspended account appeals / complaints */}
      {suspendedContacts.length > 0 && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold text-slate-300 border-b border-slate-800/60 flex items-center gap-2 md:px-6">
            <Mail className="size-4" />
            Suspended account appeals
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-400">
                  <th className="px-4 py-3 font-medium md:px-6">Date</th>
                  <th className="px-4 py-3 font-medium md:px-6">Type</th>
                  <th className="px-4 py-3 font-medium md:px-6">Name / Email</th>
                  <th className="hidden px-4 py-3 font-medium md:px-6 lg:table-cell">Message</th>
                  <th className="px-4 py-3 font-medium md:px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suspendedContacts.map((c) => (
                  <tr key={c._id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-4 py-3 md:px-6 text-slate-300">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 md:px-6">
                      <span className="capitalize text-amber-400/90">{c.type}</span>
                    </td>
                    <td className="px-4 py-3 md:px-6">
                      <span className="text-slate-300">{c.name || '—'}</span>
                      <span className="block text-xs text-slate-500">{c.email}</span>
                    </td>
                    <td className="hidden max-w-xs truncate px-4 py-3 md:px-6 lg:table-cell text-slate-400">
                      {c.message || '—'}
                    </td>
                    <td className="px-4 py-3 md:px-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.resolved && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-slate-400 hover:text-slate-300"
                              onClick={() => toggleBlockContact(c, c.resolved!.blocked)}
                              disabled={busy[`contact-${c.resolved.id}`]}
                            >
                              {c.resolved.blocked ? (
                                <>
                                  <ShieldOff className="mr-1 size-3.5" />
                                  Remove block
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-1 size-3.5" />
                                  Block
                                </>
                              )}
                            </Button>
                            {c.resolved.phone && (
                              <>
                                <a
                                  href={getWhatsAppUrl(c.resolved.phone)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700/50"
                                >
                                  <MessageCircle className="size-3.5" />
                                  WhatsApp
                                </a>
                                <a
                                  href={`tel:${c.resolved.phone.replace(/[^\d+]/g, '')}`}
                                  className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700/50"
                                >
                                  <Phone className="size-3.5" />
                                  Call
                                </a>
                              </>
                            )}
                          </>
                        )}
                        {!c.resolved && (
                          <span className="text-xs text-slate-500">No linked account (guest submission)</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-12 text-center">
          <FileWarning className="mx-auto size-12 text-slate-600" />
          <p className="mt-4 text-slate-400">
            {showArchived ? 'No archived reports.' : 'No reports yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-400">
                  <th className="px-4 py-3 font-medium md:px-6">Date</th>
                  <th className="px-4 py-3 font-medium md:px-6">Reporter → Reported</th>
                  <th className="px-4 py-3 font-medium md:px-6">Category</th>
                  <th className="hidden px-4 py-3 font-medium md:px-6 lg:table-cell">Order</th>
                  <th className="hidden px-4 py-3 font-medium md:px-6 lg:table-cell">Details</th>
                  <th className="px-4 py-3 font-medium md:px-6">Reported #</th>
                  <th className="px-4 py-3 font-medium md:px-6">Status</th>
                  <th className="px-4 py-3 font-medium md:px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const count = getReportedCount(r, reportCounts)
                  const reportedBlockEp = getBlockEndpoint(r, true)
                  const reporterBlockEp = getBlockEndpoint(r, false)
                  return (
                    <tr key={r._id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                      <td className="whitespace-nowrap px-4 py-3 md:px-6 text-slate-300">
                        {r._createdAt ? new Date(r._createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 md:px-6">
                        <span className="capitalize text-amber-400/90">{r.reporterType}</span>
                        <span className="text-slate-500"> → </span>
                        <span className="capitalize text-slate-300">{r.reportedType}</span>
                        {r.reportedCustomerInfo && (
                          <span className="block text-xs text-slate-500">{r.reportedCustomerInfo}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 md:px-6 text-slate-300">{categoryLabel(r)}</td>
                      <td className="hidden px-4 py-3 md:px-6 lg:table-cell font-mono text-slate-400">
                        {r.orderNumber ? `#${r.orderNumber}` : '—'}
                      </td>
                      <td className="hidden max-w-xs truncate px-4 py-3 md:px-6 lg:table-cell text-slate-400">
                        {r.description || '—'}
                      </td>
                      <td className="px-4 py-3 md:px-6">
                        <span className="font-medium text-slate-300" title="Times this party was reported">
                          {count}
                        </span>
                      </td>
                      <td className="px-4 py-3 md:px-6">
                        <span className="rounded-full border border-slate-600 bg-slate-800/50 px-2 py-0.5 text-xs capitalize text-slate-300">
                          {r.status ?? 'new'}
                        </span>
                      </td>
                      <td className="px-4 py-3 md:px-6">
                        <div className="flex flex-wrap items-center gap-2">
                          {!r.archived && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-slate-400 hover:text-slate-300"
                              onClick={() => archiveReport(r._id)}
                              disabled={busy[r._id]}
                            >
                              <Archive className="mr-1 size-3.5" />
                              Mark read
                            </Button>
                          )}
                          {r.reporterPhone && (
                            <a
                              href={`tel:${r.reporterPhone.replace(/[^\d+]/g, '')}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700/50"
                            >
                              <Phone className="size-3.5" />
                              Call reporter
                            </a>
                          )}
                          {r.reportedPhone && (
                            <a
                              href={`tel:${r.reportedPhone.replace(/[^\d+]/g, '')}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700/50"
                            >
                              <Phone className="size-3.5" />
                              Call reported
                            </a>
                          )}
                          {reportedBlockEp && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-slate-400 hover:text-slate-300"
                              onClick={() => toggleBlock(r, true, r.reportedBlocked)}
                              disabled={busy[`${reportedBlockEp.id}-reported`]}
                            >
                              {r.reportedBlocked ? (
                                <>
                                  <ShieldOff className="mr-1 size-3.5" />
                                  Unblock reported
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-1 size-3.5" />
                                  Block reported
                                </>
                              )}
                            </Button>
                          )}
                          {reporterBlockEp && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-slate-400 hover:text-slate-300"
                              onClick={() => toggleBlock(r, false, r.reporterBlocked)}
                              disabled={busy[`${reporterBlockEp.id}-reporter`]}
                            >
                              {r.reporterBlocked ? (
                                <>
                                  <ShieldOff className="mr-1 size-3.5" />
                                  Unblock reporter
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-1 size-3.5" />
                                  Block reporter
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
