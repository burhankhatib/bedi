'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowRightLeft, CheckCircle, XCircle, Loader2, Building2, Mail, Calendar, UserPlus } from 'lucide-react'
import Link from 'next/link'

type TransferRequest = {
  _id: string
  status: string
  newOwnerEmail: string
  requestedByEmail?: string
  createdAt?: string
  reviewedAt?: string
  rejectionReason?: string
  tenantName?: string
  tenantSlug?: string
}

type Tenant = {
  _id: string
  name: string
  slug: string
  clerkUserEmail?: string
}

const OTHER_OWNER_VALUE = '__other__'

export function AdminTransfersClient({ tenants }: { tenants: Tenant[] }) {
  const router = useRouter()
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [registeredEmails, setRegisteredEmails] = useState<string[]>([])

  // Direct assign
  const [directBusinessId, setDirectBusinessId] = useState('')
  const [directOwnerValue, setDirectOwnerValue] = useState('')
  const [directOtherEmail, setDirectOtherEmail] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Add owner (multi-owner)
  const [addOwnerBusinessId, setAddOwnerBusinessId] = useState('')
  const [addOwnerValue, setAddOwnerValue] = useState('')
  const [addOwnerOtherEmail, setAddOwnerOtherEmail] = useState('')
  const [addingOwner, setAddingOwner] = useState(false)

  // Assign to someone else (per request): which request, dropdown value (email or __other__), typed email when Other
  const [assignOtherRequestId, setAssignOtherRequestId] = useState<string | null>(null)
  const [assignOtherSelectValue, setAssignOtherSelectValue] = useState('')
  const [assignOtherInputValue, setAssignOtherInputValue] = useState('')

  useEffect(() => {
    fetch('/api/admin/registered-emails')
      .then((r) => r.json())
      .then((data: { emails?: string[] }) => setRegisteredEmails(Array.isArray(data?.emails) ? data.emails : []))
      .catch(() => setRegisteredEmails([]))
  }, [])

  const fetchRequests = () => {
    setLoading(true)
    fetch('/api/admin/transfers')
      .then((r) => r.json())
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleApprove = async (id: string, assignToEmail?: string) => {
    setActing(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/transfers/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignToEmail ? { assignToEmail } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to approve')
        return
      }
      setAssignOtherRequestId(null)
      setAssignOtherSelectValue('')
      setAssignOtherInputValue('')
      fetchRequests()
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (id: string) => {
    setActing(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/transfers/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to reject')
        return
      }
      fetchRequests()
    } finally {
      setActing(null)
    }
  }

  const handleDirectAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    const businessTenantId = directBusinessId.trim()
    const newOwnerEmail =
      directOwnerValue === OTHER_OWNER_VALUE
        ? directOtherEmail.trim().toLowerCase()
        : directOwnerValue
    if (!businessTenantId || !newOwnerEmail) {
      setError('Select a business and a new owner.')
      return
    }
    setAssigning(true)
    setError('')
    try {
      const res = await fetch('/api/admin/transfers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessTenantId, newOwnerEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to assign')
        return
      }
      setDirectBusinessId('')
      setDirectOwnerValue('')
      setDirectOtherEmail('')
      fetchRequests()
      router.refresh()
    } finally {
      setAssigning(false)
    }
  }

  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault()
    const businessTenantId = addOwnerBusinessId.trim()
    const newOwnerEmail =
      addOwnerValue === OTHER_OWNER_VALUE ? addOwnerOtherEmail.trim().toLowerCase() : addOwnerValue
    if (!businessTenantId || !newOwnerEmail) {
      setError('Select a business and an email to add as owner.')
      return
    }
    setAddingOwner(true)
    setError('')
    try {
      const res = await fetch('/api/admin/transfers/add-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessTenantId, newOwnerEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to add owner')
        return
      }
      setAddOwnerBusinessId('')
      setAddOwnerValue('')
      setAddOwnerOtherEmail('')
      router.refresh()
    } finally {
      setAddingOwner(false)
    }
  }

  const formatDate = (s?: string) =>
    s ? new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'

  const pending = requests.filter((r) => r.status === 'pending')
  const resolved = requests.filter((r) => r.status !== 'pending')

  // Tenant owners for dropdown (business name + email)
  const tenantOwnerEmails = new Set(tenants.map((t) => t.clerkUserEmail?.toLowerCase()).filter(Boolean))
  // All registered emails not already shown as a tenant owner (so we show "Other registered users")
  const otherRegisteredEmails = registeredEmails.filter((e) => !tenantOwnerEmails.has(e.toLowerCase()))

  const getAssignToEffectiveEmail = (requestId: string) => {
    if (assignOtherRequestId !== requestId) return ''
    if (assignOtherSelectValue === OTHER_OWNER_VALUE) return assignOtherInputValue.trim().toLowerCase()
    return assignOtherSelectValue.trim().toLowerCase() || ''
  }

  return (
    <div className="mt-6 space-y-8">
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Direct assign: any business → any tenant/email */}
      <section className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <UserPlus className="size-5 text-amber-400" />
          Assign business (direct)
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Select a business and assign it to an existing tenant owner or to another registered email.
        </p>
        <form onSubmit={handleDirectAssign} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400">Business</label>
            <select
              value={directBusinessId}
              onChange={(e) => setDirectBusinessId(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              <option value="">Select business…</option>
              {tenants.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} {t.clerkUserEmail ? `(${t.clerkUserEmail})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[220px]">
            <label className="block text-xs font-medium text-slate-400">New owner</label>
            <select
              value={directOwnerValue}
              onChange={(e) => {
                setDirectOwnerValue(e.target.value)
                if (e.target.value !== OTHER_OWNER_VALUE) setDirectOtherEmail('')
              }}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              <option value="">Select owner…</option>
              {tenants.filter((t) => t.clerkUserEmail).map((t) => (
                <option key={t._id} value={t.clerkUserEmail!}>
                  {t.name} ({t.clerkUserEmail})
                </option>
              ))}
              {otherRegisteredEmails.length > 0 && (
                <optgroup label="Other registered users">
                  {otherRegisteredEmails.map((em) => (
                    <option key={em} value={em}>
                      {em}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value={OTHER_OWNER_VALUE}>Other (enter email)</option>
            </select>
            {directOwnerValue === OTHER_OWNER_VALUE && (
              <input
                type="email"
                value={directOtherEmail}
                onChange={(e) => setDirectOtherEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            )}
          </div>
          <Button
            type="submit"
            disabled={assigning || !directBusinessId || !directOwnerValue || (directOwnerValue === OTHER_OWNER_VALUE && !directOtherEmail.trim())}
            className="gap-1.5 bg-amber-500 text-slate-950 hover:bg-amber-400"
          >
            {assigning ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {assigning ? 'Assigning…' : 'Set primary owner'}
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-700/60 pt-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Add another owner</h3>
          <p className="mb-4 text-xs text-slate-500">
            Add an additional owner without removing the primary. They can manage the business the same way.
          </p>
          <form onSubmit={handleAddOwner} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[200px]">
              <label className="block text-xs font-medium text-slate-400">Business</label>
              <select
                value={addOwnerBusinessId}
                onChange={(e) => setAddOwnerBusinessId(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              >
                <option value="">Select business…</option>
                {tenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} {t.clerkUserEmail ? `(${t.clerkUserEmail})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[220px]">
              <label className="block text-xs font-medium text-slate-400">Email to add</label>
              <select
                value={addOwnerValue}
                onChange={(e) => {
                  setAddOwnerValue(e.target.value)
                  if (e.target.value !== OTHER_OWNER_VALUE) setAddOwnerOtherEmail('')
                }}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              >
                <option value="">Select…</option>
                {tenants.filter((t) => t.clerkUserEmail).map((t) => (
                  <option key={t._id} value={t.clerkUserEmail!}>
                    {t.name} ({t.clerkUserEmail})
                  </option>
                ))}
                {otherRegisteredEmails.length > 0 && (
                  <optgroup label="Other registered users">
                    {otherRegisteredEmails.map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value={OTHER_OWNER_VALUE}>Other (enter email)</option>
              </select>
              {addOwnerValue === OTHER_OWNER_VALUE && (
                <input
                  type="email"
                  value={addOwnerOtherEmail}
                  onChange={(e) => setAddOwnerOtherEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
              )}
            </div>
            <Button
              type="submit"
              disabled={addingOwner || !addOwnerBusinessId || !addOwnerValue || (addOwnerValue === OTHER_OWNER_VALUE && !addOwnerOtherEmail.trim())}
              variant="outline"
              className="gap-1.5 border-slate-600 text-slate-200 hover:bg-slate-800"
            >
              {addingOwner ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              {addingOwner ? 'Adding…' : 'Add owner'}
            </Button>
          </form>
        </div>
      </section>

      {/* Pending requests from tenants */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <ArrowRightLeft className="size-5 text-amber-400" />
          Pending requests ({pending.length})
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="size-5 animate-spin" />
            Loading…
          </div>
        ) : pending.length === 0 ? (
          <p className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-8 text-center text-slate-500">
            No pending transfer requests. Tenants can submit a request from their business Transfer page.
          </p>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => (
              <div
                key={r._id}
                className="flex flex-col gap-4 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                      <Building2 className="size-4 shrink-0 text-slate-500" />
                      <span>{r.tenantName ?? 'Business'}</span>
                      {r.tenantSlug && (
                        <Link
                          href={`/t/${r.tenantSlug}/manage`}
                          className="text-xs text-amber-400 hover:underline"
                        >
                          /t/{r.tenantSlug}
                        </Link>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3.5" />
                        Current: {r.requestedByEmail ?? '—'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        → Requested: {r.newOwnerEmail}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
                      disabled={acting !== null}
                      onClick={() => handleApprove(r._id)}
                    >
                      {acting === r._id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle className="size-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-slate-600 text-slate-300 hover:bg-slate-800"
                      disabled={acting !== null}
                      onClick={() => handleReject(r._id)}
                    >
                      {acting === r._id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
                {/* Assign to someone else */}
                <div className="border-t border-slate-700/60 pt-4">
                  <p className="mb-2 text-xs font-medium text-slate-400">Assign to someone else</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <select
                      value={assignOtherRequestId === r._id ? assignOtherSelectValue : ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setAssignOtherRequestId(r._id)
                        setAssignOtherSelectValue(v)
                        if (v !== OTHER_OWNER_VALUE) setAssignOtherInputValue('')
                      }}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                      <option value="">Select owner…</option>
                      {tenants.filter((t) => t.clerkUserEmail).map((t) => (
                        <option key={t._id} value={t.clerkUserEmail!}>
                          {t.name} ({t.clerkUserEmail})
                        </option>
                      ))}
                      {otherRegisteredEmails.length > 0 && (
                        <optgroup label="Other registered users">
                          {otherRegisteredEmails.map((em) => (
                            <option key={em} value={em}>
                              {em}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value={OTHER_OWNER_VALUE}>Other (enter email)</option>
                    </select>
                    {assignOtherRequestId === r._id && assignOtherSelectValue === OTHER_OWNER_VALUE && (
                      <input
                        type="email"
                        value={assignOtherInputValue}
                        onChange={(e) => setAssignOtherInputValue(e.target.value)}
                        placeholder="email@example.com"
                        className="w-48 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                    )}
                    {assignOtherRequestId === r._id && assignOtherSelectValue && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                        disabled={
                          acting !== null ||
                          !getAssignToEffectiveEmail(r._id)
                        }
                        onClick={() => {
                          const email = getAssignToEffectiveEmail(r._id)
                          if (email) handleApprove(r._id, email)
                        }}
                      >
                        {acting === r._id ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                        Assign to selected
                      </Button>
                    )}
                  </div>
                  {assignOtherRequestId === r._id && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Choose a different owner than requested, then click Assign to selected. They must be registered on the website.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-400">Resolved ({resolved.length})</h2>
          <div className="space-y-3">
            {resolved.map((r) => (
              <div
                key={r._id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-800/40 bg-slate-900/20 px-4 py-3 text-sm"
              >
                <span className="font-medium">{r.tenantName ?? 'Business'}</span>
                <span className="text-slate-500">→ {r.newOwnerEmail}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {r.status}
                </span>
                <span className="text-slate-500">{formatDate(r.reviewedAt ?? r.createdAt)}</span>
                {r.rejectionReason && (
                  <span className="w-full text-slate-500">Reason: {r.rejectionReason}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
