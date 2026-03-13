'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileWarning, Loader2, Phone, Archive, Shield, ShieldOff, MessageCircle, Mail, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCategoryLabel } from '@/lib/report-categories'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { VerifyToggle } from '@/components/admin/VerifyToggle'
import Link from 'next/link'

type PendingDriver = {
  _id: string
  name?: string
  phoneNumber?: string
  country?: string
  city?: string
  _createdAt: string
}

type Report = {
  _id: string
  _createdAt: string
  reporterType?: string
  reportedType?: string
  category?: string
  description?: string
  status?: string
  archived?: boolean
  orderId?: string
  orderNumber?: string
  reportedCustomerInfo?: string
  reporterTenantId?: string
  reporterDriverId?: string
  reportedTenantId?: string
  reportedDriverId?: string
  reporterPhone: string | null
  reportedPhone: string | null
  reportedCustomerId: string | null
  /** Order's customer _ref (used for Block reporter when reporter is customer) */
  orderCustomerId?: string | null
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
    if (r.reporterType === 'customer' && r.orderCustomerId)
      return { url: `/api/admin/customers/${r.orderCustomerId}/block`, id: r.orderCustomerId }
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
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'new' | 'read' | 'archived'>('new')
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [repairBusy, setRepairBusy] = useState(false)
  const [repairResult, setRepairResult] = useState<{
    dryRun: boolean
    scanned: number
    skipped: number
    created: number
    updated: number
    typeStats?: Record<string, number>
  } | null>(null)

  const fetchReports = useCallback(() => {
    setLoading(true)
    const q = `?filter=${filter}`
    Promise.all([
      fetch(`/api/admin/reports${q}`, { credentials: 'include' }).then((res) => res.json()),
      fetch(`/api/admin/suspended-contacts${q}`, { credentials: 'include' }).then((res) => res.json()),
    ])
      .then(([reportsData, contactsData]) => {
        setReports(Array.isArray(reportsData.reports) ? reportsData.reports : [])
        setReportCounts(reportsData.reportCounts ?? { tenant: {}, driver: {}, customer: {} })
        setPendingDrivers(Array.isArray(reportsData.pendingDrivers) ? reportsData.pendingDrivers : [])
        setSuspendedContacts(Array.isArray(contactsData.contacts) ? contactsData.contacts : [])
      })
      .catch(() => {
        setReports([])
        setReportCounts({ tenant: {}, driver: {}, customer: {} })
        setPendingDrivers([])
        setSuspendedContacts([])
      })
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const updateTaskState = async (id: string, type: 'report' | 'driver' | 'suspendedContact', updates: { status?: string, archived?: boolean }) => {
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      const res = await fetch(`/api/admin/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, ...updates }),
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

  const runPushRepair = async (dryRun: boolean) => {
    setRepairBusy(true)
    try {
      const res = await fetch('/api/admin/push/repair-subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, limit: 2000 }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setRepairResult({
          dryRun: Boolean(data?.dryRun),
          scanned: Number(data?.scanned) || 0,
          skipped: Number(data?.skipped) || 0,
          created: Number(data?.created) || 0,
          updated: Number(data?.updated) || 0,
          typeStats: data?.typeStats && typeof data.typeStats === 'object' ? data.typeStats : undefined,
        })
      } else {
        setRepairResult(null)
      }
    } finally {
      setRepairBusy(false)
    }
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
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter('new')}
          className={filter === 'new'
            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 hover:text-slate-950 border-amber-500'
            : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white'}
        >
          New
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter('read')}
          className={filter === 'read'
            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 hover:text-slate-950 border-amber-500'
            : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white'}
        >
          Read
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter('archived')}
          className={filter === 'archived'
            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 hover:text-slate-950 border-amber-500'
            : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white'}
        >
          Archived
        </Button>
      </div>

      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-200">Push Subscription Repair</p>
            <p className="text-xs text-emerald-300/80">
              Rebuild central push subscriptions from legacy tokens (tenant, staff, driver, customer).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-emerald-600 text-emerald-200 hover:bg-emerald-900/40"
              onClick={() => runPushRepair(true)}
              disabled={repairBusy}
            >
              {repairBusy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Dry Run
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => runPushRepair(false)}
              disabled={repairBusy}
            >
              {repairBusy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Run Repair
            </Button>
          </div>
        </div>
        {repairResult && (
          <p className="mt-2 text-xs text-emerald-200/90">
            {repairResult.dryRun ? 'Dry run' : 'Executed'}: scanned {repairResult.scanned}, skipped {repairResult.skipped}, created {repairResult.created}, updated {repairResult.updated}
            {repairResult.typeStats
              ? ` | tenants ${repairResult.typeStats.tenants ?? 0}, staff ${repairResult.typeStats.tenantStaff ?? 0}, drivers ${repairResult.typeStats.drivers ?? 0}, customers ${repairResult.typeStats.customersFromOrders ?? 0}`
              : ''}
          </p>
        )}
      </div>

      {/* Pending Drivers */}
      {pendingDrivers.length > 0 && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold text-slate-300 border-b border-slate-800/60 flex items-center justify-between md:px-6">
            <span className="flex items-center gap-2">
              <Truck className="size-4 text-amber-400" />
              Drivers Pending Verification
            </span>
            <Button asChild variant="ghost" size="sm" className="h-6 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-400/10">
              <Link href="/admin/drivers">Manage Drivers</Link>
            </Button>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-400">
                  <th className="px-4 py-3 font-medium md:px-6">Joined Date</th>
                  <th className="px-4 py-3 font-medium md:px-6">Name</th>
                  <th className="px-4 py-3 font-medium md:px-6">Phone</th>
                  <th className="px-4 py-3 font-medium md:px-6">Location</th>
                  <th className="px-4 py-3 font-medium md:px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingDrivers.map((d) => (
                  <tr key={d._id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-4 py-3 md:px-6 text-slate-300">
                      {d._createdAt ? new Date(d._createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 md:px-6 text-slate-300 font-medium">
                      {d.name || '—'}
                    </td>
                    <td className="px-4 py-3 md:px-6 font-mono text-slate-400">
                      {d.phoneNumber || '—'}
                    </td>
                    <td className="px-4 py-3 md:px-6 text-slate-400">
                      {[d.city, d.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 md:px-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {filter !== 'read' && filter !== 'archived' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-slate-400 hover:text-slate-300"
                            onClick={() => updateTaskState(d._id, 'driver', { status: 'read' })}
                            disabled={busy[d._id]}
                          >
                            Mark Read
                          </Button>
                        )}
                        {filter !== 'archived' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-slate-400 hover:text-slate-300"
                            onClick={() => updateTaskState(d._id, 'driver', { archived: true })}
                            disabled={busy[d._id]}
                          >
                            <Archive className="mr-1 size-3.5" />
                            Archive
                          </Button>
                        )}
                        <VerifyToggle
                          id={d._id}
                          verified={false}
                          onSuccess={() => setPendingDrivers(prev => prev.filter(x => x._id !== d._id))}
                        />
                        {d.phoneNumber && (
                          <>
                            <a
                              href={getWhatsAppUrl(d.phoneNumber)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700/50"
                            >
                              <MessageCircle className="size-3.5" />
                              WhatsApp
                            </a>
                            <a
                              href={`tel:${d.phoneNumber.replace(/[^\d+]/g, '')}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700/50"
                            >
                              <Phone className="size-3.5" />
                              Call
                            </a>
                          </>
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
                        {filter !== 'read' && filter !== 'archived' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-slate-400 hover:text-slate-300"
                            onClick={() => updateTaskState(c._id, 'suspendedContact', { status: 'read' })}
                            disabled={busy[c._id]}
                          >
                            Mark Read
                          </Button>
                        )}
                        {filter !== 'archived' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-slate-400 hover:text-slate-300"
                            onClick={() => updateTaskState(c._id, 'suspendedContact', { archived: true })}
                            disabled={busy[c._id]}
                          >
                            <Archive className="mr-1 size-3.5" />
                            Archive
                          </Button>
                        )}
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
            {filter === 'archived' ? 'No archived reports.' : 'No reports yet.'}
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
                        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                          {/* Report-level actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            {filter !== 'read' && filter !== 'archived' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-slate-400 hover:text-slate-300"
                                onClick={() => updateTaskState(r._id, 'report', { status: 'read' })}
                                disabled={busy[r._id]}
                              >
                                Mark Read
                              </Button>
                            )}
                            {filter !== 'archived' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-slate-400 hover:text-slate-300"
                                onClick={() => updateTaskState(r._id, 'report', { archived: true })}
                                disabled={busy[r._id]}
                              >
                                <Archive className="mr-1 size-3.5" />
                                Archive
                              </Button>
                            )}
                          </div>
                          {/* Reporter actions */}
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-amber-400/90">Reporter</span>
                            <div className="flex flex-wrap items-center gap-2">
                              {r.orderId && (
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-slate-400 hover:text-amber-400"
                                >
                                  <Link href={`/admin/orders/${r.orderId}`}>
                                    View Order
                                  </Link>
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
                          </div>
                          {/* Reported actions */}
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-400">Reported</span>
                            <div className="flex flex-wrap items-center gap-2">
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
                            </div>
                          </div>
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
