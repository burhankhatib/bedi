'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Building2, Mail, ExternalLink, Settings, Plus, Loader2, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { BlockToggle } from '@/components/admin/BlockToggle'
import { BUSINESS_TYPES } from '@/lib/constants'

type Tenant = {
  _id: string
  name: string
  slug: string
  businessType: string
  clerkUserEmail?: string
  coOwnerEmails?: string[]
  subscriptionStatus: string
  subscriptionExpiresAt?: string | null
  createdAt?: string
  businessCreatedAt?: string | null
  city?: string | null
  blockedBySuperAdmin?: boolean
}

export function AdminBusinessesTable({ tenants }: { tenants: Tenant[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSlug, setCreateSlug] = useState('')
  const [createType, setCreateType] = useState('restaurant')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [subModalOpen, setSubModalOpen] = useState(false)
  const [subTenant, setSubTenant] = useState<Tenant | null>(null)
  const [subExpiresAt, setSubExpiresAt] = useState('')
  const [subStatus, setSubStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [filterQuery, setFilterQuery] = useState('')
  const [filterCity, setFilterCity] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const uniqueCities = Array.from(new Set(tenants.map(t => t.city).filter(Boolean))) as string[]

  const getDaysLeft = (t: Tenant) => {
    const now = Date.now()
    let expiry = 0
    if (t.subscriptionExpiresAt) {
      expiry = new Date(t.subscriptionExpiresAt).getTime()
    } else {
      const createdDate = t.businessCreatedAt || t.createdAt
      if (createdDate) {
        expiry = new Date(createdDate).getTime() + 30 * 24 * 60 * 60 * 1000
      }
    }
    if (!expiry) return null
    const diff = expiry - now
    if (diff <= 0) return 0
    return Math.ceil(diff / (24 * 60 * 60 * 1000))
  }

  const filteredTenants = tenants.filter((t) => {
    if (filterQuery) {
      const q = filterQuery.toLowerCase()
      const matchName = t.name?.toLowerCase().includes(q)
      const matchSlug = t.slug?.toLowerCase().includes(q)
      const matchEmail = t.clerkUserEmail?.toLowerCase().includes(q)
      if (!matchName && !matchSlug && !matchEmail) return false
    }
    if (filterCity !== 'all' && t.city !== filterCity) {
      return false
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'expired') {
        const dl = getDaysLeft(t)
        if (dl !== 0) return false
      } else if (filterStatus === 'active_or_trial') {
        const dl = getDaysLeft(t)
        if (dl === 0) return false
      } else {
        if (t.subscriptionStatus !== filterStatus) return false
      }
    }
    return true
  })

  const sortedTenants = [...filteredTenants].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.name.localeCompare(b.name)
    }
    if (sortBy === 'expiring') {
      const aDays = getDaysLeft(a) ?? Infinity
      const bDays = getDaysLeft(b) ?? Infinity
      return aDays - bDays
    }
    return 0 // default 'newest' uses original array order
  })

  const openSubModal = (t: Tenant) => {
    setSubTenant(t)
    let initialDate = ''
    if (t.subscriptionExpiresAt) {
      initialDate = new Date(t.subscriptionExpiresAt).toISOString().slice(0, 16)
    } else {
      const createdDate = t.businessCreatedAt || t.createdAt
      if (createdDate) {
        initialDate = new Date(new Date(createdDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      }
    }
    setSubExpiresAt(initialDate)
    setSubStatus(t.subscriptionStatus || 'trial')
    setSubModalOpen(true)
  }

  const handleSubSubmit = async (e?: React.FormEvent, isGracePeriod = false) => {
    if (e) e.preventDefault()
    if (!subTenant) return
    setSubmitting(true)
    
    let newExpiresAt = subExpiresAt ? new Date(subExpiresAt).toISOString() : null
    let newStatus = subStatus
    
    if (isGracePeriod) {
      const now = Date.now()
      let baseTime = now
      if (subTenant.subscriptionExpiresAt) {
        const currentExp = new Date(subTenant.subscriptionExpiresAt).getTime()
        if (currentExp > now) baseTime = currentExp
      } else {
        const createdDate = subTenant.businessCreatedAt || subTenant.createdAt
        if (createdDate) {
          const currentExp = new Date(createdDate).getTime() + 30 * 24 * 60 * 60 * 1000
          if (currentExp > now) baseTime = currentExp
        }
      }
      newExpiresAt = new Date(baseTime + 3 * 24 * 60 * 60 * 1000).toISOString()
      newStatus = subTenant.subscriptionStatus === 'past_due' ? 'active' : (subTenant.subscriptionStatus || 'trial')
    }

    try {
      const res = await fetch(`/api/admin/tenants/${subTenant._id}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionExpiresAt: newExpiresAt,
          subscriptionStatus: newStatus,
        })
      })
      if (!res.ok) throw new Error('Update failed')
      setSubModalOpen(false)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to update subscription')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = createName.trim()
    if (!name) return
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          slug: createSlug.trim() || undefined,
          businessType: createType,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create business')
        return
      }
      setCreateOpen(false)
      setCreateName('')
      setCreateSlug('')
      setCreateType('restaurant')
      if (data.tenant?.slug) {
        router.push(`/t/${data.tenant.slug}/manage/transfer`)
      } else {
        router.refresh()
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40">
      <div className="border-b border-slate-800/60 px-4 py-3 md:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold">All tenants ({tenants.length})</h2>
          <p className="text-sm text-slate-500">Block: Super Admin only. Blocked businesses cannot access the control panel or receive orders.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 bg-amber-500 text-slate-950 hover:bg-amber-400" size="sm">
              <Plus className="size-4 mr-1.5" />
              Create business
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-700 bg-slate-900 text-white">
            <DialogHeader>
              <DialogTitle>Create new business</DialogTitle>
              <p className="text-sm text-slate-400">The business will be owned by you until you transfer it to the final owner.</p>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Business name *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  placeholder="e.g. My Restaurant"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Slug (optional)</label>
                <input
                  type="text"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 font-mono text-sm"
                  placeholder="my-restaurant (defaults from name)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Business type *</label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {createError && <p className="text-sm text-red-400">{createError}</p>}
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating} className="border-slate-600 text-slate-300 hover:bg-slate-800">
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                  {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  {creating ? ' Creating…' : ' Create & transfer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-b border-slate-800/60 bg-slate-900/60 px-4 py-3 md:px-6 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name, slug, email..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="w-full sm:max-w-xs rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="w-full sm:w-auto rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="all">All Cities</option>
          {uniqueCities.sort().map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full sm:w-auto rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="all">All Statuses</option>
          <option value="active_or_trial">Active / Trial</option>
          <option value="expired">Expired</option>
          <option value="past_due">Past Due</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full sm:w-auto rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="newest">Newest First</option>
          <option value="alphabetical">A-Z</option>
          <option value="expiring">Expiring Soon</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800/60 text-slate-400">
              <th className="px-4 py-3 font-medium md:px-6">Business</th>
              <th className="px-4 py-3 font-medium md:px-6">Type</th>
              <th className="px-4 py-3 font-medium md:px-6">Owner email(s)</th>
              <th className="px-4 py-3 font-medium md:px-6">Status</th>
              <th className="px-4 py-3 font-medium md:px-6">Slug</th>
              <th className="px-4 py-3 font-medium md:px-6 text-center">Block</th>
              <th className="px-4 py-3 font-medium md:px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedTenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500 md:px-6">
                  No businesses found.
                </td>
              </tr>
            ) : (
              sortedTenants.map((t) => {
                const daysLeft = getDaysLeft(t)
                return (
                <tr
                  key={t._id}
                  className={`border-b border-slate-800/40 transition-colors hover:bg-slate-800/30 ${t.blockedBySuperAdmin ? 'opacity-80' : ''}`}
                >
                  <td className="px-4 py-3 md:px-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 shrink-0 text-slate-500" />
                        <span className="font-medium">{t.name}</span>
                      </div>
                      {daysLeft !== null && (
                        <span className={`text-xs font-medium ${daysLeft <= 7 ? (daysLeft === 0 ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'}`}>
                          {daysLeft === 0 ? 'Expired' : `${daysLeft} days left`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-400 md:px-6">{t.businessType}</td>
                  <td className="px-4 py-3 text-slate-400 md:px-6">
                    {t.clerkUserEmail || (t.coOwnerEmails && t.coOwnerEmails.length > 0) ? (
                      <span className="flex flex-col gap-0.5">
                        {t.clerkUserEmail && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="size-3.5 shrink-0" />
                            {t.clerkUserEmail}
                          </span>
                        )}
                        {t.coOwnerEmails?.filter(Boolean).map((e) => (
                          <span key={e} className="flex items-center gap-1.5 text-slate-500 text-xs">
                            <Mail className="size-3 shrink-0" />
                            {e}
                          </span>
                        ))}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 md:px-6">
                    <span className="rounded-full border border-slate-600 bg-slate-800/50 px-2 py-0.5 text-xs capitalize text-slate-300">
                      {t.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400 md:px-6">/t/{t.slug}</td>
                  <td className="px-4 py-3 md:px-6 text-center">
                    <BlockToggle
                      id={t._id}
                      type="tenant"
                      blocked={!!t.blockedBySuperAdmin}
                      onSuccess={() => window.location.reload()}
                    />
                  </td>
                  <td className="px-4 py-3 md:px-6">
                    <div className="flex items-center justify-end gap-1">
                      <Button onClick={() => openSubModal(t)} size="sm" variant="ghost" className="text-emerald-400 hover:text-emerald-300" title="Manage subscription">
                        <Calendar className="size-3.5" />
                      </Button>
                      <Button asChild size="sm" variant="ghost" className="text-slate-400 hover:text-white" title="Open menu (public)">
                        <Link href={`/t/${t.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost" className="text-amber-400 hover:text-amber-300" title="Open control panel">
                        <Link href={`/t/${t.slug}/manage`}>
                          <Settings className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })
            )}
          </tbody>
        </table>
      </div>
      <Dialog open={subModalOpen} onOpenChange={setSubModalOpen}>
        <DialogContent className="border-slate-700 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <p className="text-sm text-slate-400">
              {subTenant?.name} - Currently: <span className="capitalize">{subTenant?.subscriptionStatus}</span>
            </p>
          </DialogHeader>
          <form onSubmit={(e) => handleSubSubmit(e, false)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Expiration Date & Time</label>
              <input
                type="datetime-local"
                value={subExpiresAt}
                onChange={(e) => setSubExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
              <select
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="past_due">Past Due</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <DialogFooter className="gap-2 pt-2 flex flex-col sm:flex-row sm:justify-between items-center w-full">
              <Button 
                type="button" 
                variant="secondary"
                onClick={() => handleSubSubmit(undefined, true)}
                disabled={submitting} 
                className="w-full sm:w-auto bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 hover:text-emerald-300 border-0"
              >
                {submitting ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                +3 Days Grace
              </Button>
              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <Button type="button" variant="outline" onClick={() => setSubModalOpen(false)} disabled={submitting} className="flex-1 sm:flex-none border-slate-600 text-slate-300 hover:bg-slate-800">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 sm:flex-none bg-amber-500 text-slate-950 hover:bg-amber-400">
                  {submitting ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
