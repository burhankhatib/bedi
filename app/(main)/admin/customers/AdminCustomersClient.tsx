'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { Users, Loader2, Search, MessageCircle, Filter, ChevronDown, ChevronRight, Store } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BlockToggle } from '@/components/admin/BlockToggle'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type BusinessSpendItem = {
  businessName: string
  city?: string
  totalSpent: number
  orderCount: number
}

type RecentOrder = {
  orderNumber?: string
  siteName?: string
  totalAmount?: number
  currency?: string
  status?: string
  createdAt?: string
}

type Customer = {
  _id: string
  name?: string
  primaryPhone?: string
  email?: string
  firstOrderAt?: string
  lastOrderAt?: string
  orderCount?: number
  blockedBySuperAdmin?: boolean
  totalSpent?: number
  totalSpentCurrency?: string
  businesses?: string[]
  businessSpend?: BusinessSpendItem[]
  customerCities?: string[]
  recentOrders?: RecentOrder[]
}

const DATE_PRESETS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
] as const

const COLUMN_KEYS = [
  'name',
  'phone',
  'email',
  'orders',
  'totalSpent',
  'businesses',
  'businessBreakdown',
  'firstLastOrder',
  'block',
] as const

type ColumnKey = (typeof COLUMN_KEYS)[number]

function toWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const num = digits.startsWith('0') ? '972' + digits.slice(1) : digits.startsWith('972') ? digits : '972' + digits
  return `https://wa.me/${num}`
}

function PhoneAndWhatsApp({ phone }: { phone: string }) {
  if (!phone) return <span className="text-slate-500">—</span>
  const tel = `tel:${phone.replace(/[^\d+]/g, '')}`
  const wa = toWhatsAppUrl(phone)
  return (
    <span className="flex items-center gap-1.5">
      <a href={tel} className="font-mono text-slate-300 underline decoration-slate-500 underline-offset-2 hover:text-white hover:decoration-slate-400">
        {phone}
      </a>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 rounded p-1 text-[#25D366] hover:bg-slate-700/50"
        aria-label="WhatsApp"
        title="Open in WhatsApp"
      >
        <MessageCircle className="size-4" />
      </a>
    </span>
  )
}

function getDateRangeFromPreset(preset: string): { from: string | null; to: string | null } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  if (preset === 'all' || !preset) return { from: null, to: null }
  if (preset === 'today') return { from: to, to }
  const days = parseInt(preset, 10)
  if (Number.isNaN(days) || days < 1) return { from: null, to: null }
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - days)
  const from = fromDate.toISOString().slice(0, 10)
  return { from, to }
}

export function AdminCustomersClient() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [dateJoinedPreset, setDateJoinedPreset] = useState<string>('all')
  const [dateJoinedFrom, setDateJoinedFrom] = useState('')
  const [dateJoinedTo, setDateJoinedTo] = useState('')
  const [blockStatus, setBlockStatus] = useState<'all' | 'blocked' | 'active'>('all')
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    name: true,
    phone: true,
    email: true,
    orders: true,
    totalSpent: true,
    businesses: true,
    businessBreakdown: true,
    firstLastOrder: true,
    block: true,
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (blockStatus !== 'all') params.set('block_status', blockStatus)
    if (dateJoinedPreset === 'custom' && (dateJoinedFrom || dateJoinedTo)) {
      if (dateJoinedFrom) params.set('date_joined_from', dateJoinedFrom)
      if (dateJoinedTo) params.set('date_joined_to', dateJoinedTo)
    } else if (dateJoinedPreset && dateJoinedPreset !== 'all') {
      const { from, to } = getDateRangeFromPreset(dateJoinedPreset)
      if (from) params.set('date_joined_from', from)
      if (to) params.set('date_joined_to', to)
    }
    if (selectedCities.length > 0) params.set('cities', selectedCities.join(','))
    return params.toString()
  }, [debouncedSearch, blockStatus, dateJoinedPreset, dateJoinedFrom, dateJoinedTo, selectedCities])

  const fetchCustomers = useCallback(() => {
    setLoading(true)
    const q = buildQuery()
    const url = `/api/admin/customers${q ? `?${q}` : ''}`
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.customers)) {
          setCustomers(data.customers)
          setAvailableCities(data.availableCities ?? [])
        } else if (Array.isArray(data)) {
          setCustomers(data)
          setAvailableCities([])
        } else {
          setCustomers([])
          setAvailableCities([])
        }
      })
      .catch(() => {
        setCustomers([])
        setAvailableCities([])
      })
      .finally(() => setLoading(false))
  }, [buildQuery])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const toggleCity = (city: string) => {
    setSelectedCities((prev) => (prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]))
  }

  const toggleColumn = (key: ColumnKey) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const clearFilters = () => {
    setDateJoinedPreset('all')
    setDateJoinedFrom('')
    setDateJoinedTo('')
    setBlockStatus('all')
    setSelectedCities([])
  }

  const hasActiveFilters = blockStatus !== 'all' || dateJoinedPreset !== 'all' || selectedCities.length > 0

  if (loading && customers.length === 0) {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            type="search"
            placeholder="Search by name, mobile, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500"
            aria-label="Search customers"
          />
        </div>
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'shrink-0 border-slate-600 bg-slate-800/60 text-slate-200 hover:bg-slate-700',
                hasActiveFilters && 'ring-1 ring-amber-500/50'
              )}
            >
              <Filter className="mr-1.5 size-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
                  On
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(360px,95vw)] border-slate-800 bg-slate-950">
            <SheetHeader>
              <SheetTitle className="text-white">Filters & columns</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-300">Date joined</h3>
                <select
                  value={dateJoinedPreset}
                  onChange={(e) => setDateJoinedPreset(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {dateJoinedPreset === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">From</label>
                      <Input
                        type="date"
                        value={dateJoinedFrom}
                        onChange={(e) => setDateJoinedFrom(e.target.value)}
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">To</label>
                      <Input
                        type="date"
                        value={dateJoinedTo}
                        onChange={(e) => setDateJoinedTo(e.target.value)}
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-300">Block status</h3>
                <div className="flex gap-2">
                  {(['all', 'active', 'blocked'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBlockStatus(s)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm',
                        blockStatus === s
                          ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      )}
                    >
                      {s === 'all' ? 'All' : s === 'blocked' ? 'Blocked only' : 'Active only'}
                    </button>
                  ))}
                </div>
              </div>
              {availableCities.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-300">Customer cities</h3>
                  <p className="mb-2 text-xs text-slate-500">Show customers who purchased from businesses in:</p>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/50 p-2">
                    {availableCities.map((city) => (
                      <label key={city} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={selectedCities.includes(city)}
                          onChange={() => toggleCity(city)}
                          className="rounded border-slate-600 bg-slate-800 text-amber-500"
                        />
                        {city || '—'}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-300">Show columns</h3>
                <div className="space-y-1.5">
                  {COLUMN_KEYS.map((key) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={columnVisibility[key]}
                        onChange={() => toggleColumn(key)}
                        className="rounded border-slate-600 bg-slate-800 text-amber-500"
                      />
                      {key === 'firstLastOrder' ? 'First / Last order' : key === 'totalSpent' ? 'Total spent' : key === 'businessBreakdown' ? 'Per-business spend' : key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={clearFilters}>
                Clear all filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-12 text-center">
          <Users className="mx-auto size-12 text-slate-600" />
          <p className="mt-4 text-slate-400">
            {debouncedSearch || hasActiveFilters ? 'No customers match your search or filters.' : 'No customers yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {customers.map((c) => (
              <div
                key={c._id}
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expandedId === c._id ? null : c._id)}
                onKeyDown={(e) => e.key === 'Enter' && setExpandedId(expandedId === c._id ? null : c._id)}
                className={cn(
                  'rounded-xl border border-slate-800/60 bg-slate-900/40 p-4',
                  c.blockedBySuperAdmin && 'opacity-80'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {c.businessSpend && c.businessSpend.length > 0 ? (
                      expandedId === c._id ? (
                        <ChevronDown className="size-4 shrink-0 text-slate-500" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-slate-500" />
                      )
                    ) : null}
                    <div>
                      <p className="font-medium text-white">{c.name ?? '—'}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400">
                        <PhoneAndWhatsApp phone={c.primaryPhone ?? ''} />
                      </p>
                      {c.email && <p className="mt-0.5 text-xs text-slate-500">{c.email}</p>}
                    </div>
                  </div>
                  <BlockToggle
                    id={c._id}
                    type="customer"
                    blocked={!!c.blockedBySuperAdmin}
                    onSuccess={() => setCustomers((prev) => prev.map((x) => (x._id === c._id ? { ...x, blockedBySuperAdmin: !x.blockedBySuperAdmin } : x)))}
                  />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-slate-500">Orders</dt>
                  <dd className="text-slate-300">{c.orderCount ?? 0}</dd>
                  <dt className="text-slate-500">Total spent</dt>
                  <dd className="text-slate-300">
                    {(c.totalSpent ?? 0).toFixed(2)} {c.totalSpentCurrency ?? 'ILS'}
                  </dd>
                  <dt className="text-slate-500">First order</dt>
                  <dd className="text-slate-300">{c.firstOrderAt ? new Date(c.firstOrderAt).toLocaleDateString() : '—'}</dd>
                  <dt className="text-slate-500">Last order</dt>
                  <dd className="text-slate-300">{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}</dd>
                </dl>
                {expandedId === c._id && c.businessSpend && c.businessSpend.length > 0 && (
                  <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-800/40 p-3">
                    <p className="mb-2 text-xs font-medium text-slate-400">Spent per business</p>
                    <ul className="space-y-1.5 text-xs">
                      {c.businessSpend.map((b, i) => (
                        <li key={i} className="flex justify-between text-slate-300">
                          <span>{b.businessName}{b.city ? ` (${b.city})` : ''}</span>
                          <span>{(b.totalSpent ?? 0).toFixed(2)} · {b.orderCount ?? 0} orders</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800/60 text-slate-400">
                    <th className="w-8 px-2 py-3" />
                    {columnVisibility.name && <th className="px-4 py-3 font-medium md:px-6">Name</th>}
                    {columnVisibility.phone && <th className="px-4 py-3 font-medium md:px-6">Phone</th>}
                    {columnVisibility.email && <th className="px-4 py-3 font-medium md:px-6">Email</th>}
                    {columnVisibility.orders && <th className="px-4 py-3 font-medium md:px-6">Orders</th>}
                    {columnVisibility.totalSpent && <th className="px-4 py-3 font-medium md:px-6">Total spent</th>}
                    {columnVisibility.businesses && <th className="px-4 py-3 font-medium md:px-6">Businesses</th>}
                    {columnVisibility.businessBreakdown && <th className="px-4 py-3 font-medium md:px-6">Per-business</th>}
                    {columnVisibility.firstLastOrder && <th className="px-4 py-3 font-medium md:px-6">First / Last order</th>}
                    {columnVisibility.block && <th className="px-4 py-3 font-medium md:px-6 text-center">Block</th>}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <Fragment key={c._id}>
                      <tr
                        key={c._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedId(expandedId === c._id ? null : c._id)}
                        onKeyDown={(e) => e.key === 'Enter' && setExpandedId(expandedId === c._id ? null : c._id)}
                        className={cn(
                          'border-b border-slate-800/40 hover:bg-slate-800/30 cursor-pointer',
                          c.blockedBySuperAdmin && 'opacity-80',
                          expandedId === c._id && 'bg-slate-800/40'
                        )}
                      >
                        <td className="w-8 px-2 py-3">
                          {c.businessSpend && c.businessSpend.length > 0 ? (
                            expandedId === c._id ? (
                              <ChevronDown className="size-4 text-slate-500" />
                            ) : (
                              <ChevronRight className="size-4 text-slate-500" />
                            )
                          ) : (
                            <span className="inline-block w-4" />
                          )}
                        </td>
                        {columnVisibility.name && (
                          <td className="px-4 py-3 md:px-6 font-medium text-white">{c.name ?? '—'}</td>
                        )}
                        {columnVisibility.phone && (
                          <td className="px-4 py-3 md:px-6">
                            <PhoneAndWhatsApp phone={c.primaryPhone ?? ''} />
                          </td>
                        )}
                        {columnVisibility.email && (
                          <td className="px-4 py-3 md:px-6 text-slate-400">{c.email ?? '—'}</td>
                        )}
                        {columnVisibility.orders && (
                          <td className="px-4 py-3 md:px-6 text-slate-300">{c.orderCount ?? 0}</td>
                        )}
                        {columnVisibility.totalSpent && (
                          <td className="px-4 py-3 md:px-6 text-slate-300">
                            {(c.totalSpent ?? 0).toFixed(2)} {c.totalSpentCurrency ?? 'ILS'}
                          </td>
                        )}
                        {columnVisibility.businesses && (
                          <td className="max-w-[140px] truncate px-4 py-3 md:px-6 text-slate-400" title={c.businesses?.join(', ')}>
                            {c.businesses?.length ? c.businesses.slice(0, 2).join(', ') + (c.businesses.length > 2 ? '…' : '') : '—'}
                          </td>
                        )}
                        {columnVisibility.businessBreakdown && (
                          <td className="px-4 py-3 md:px-6 text-slate-400">
                            {c.businessSpend && c.businessSpend.length > 0 ? (
                              <span className="text-amber-400/90">{c.businessSpend.length} business{c.businessSpend.length !== 1 ? 'es' : ''}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                        )}
                        {columnVisibility.firstLastOrder && (
                          <td className="whitespace-nowrap px-4 py-3 md:px-6 text-slate-400">
                            {c.firstOrderAt ? new Date(c.firstOrderAt).toLocaleDateString() : '—'}
                            {' / '}
                            {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}
                          </td>
                        )}
                        {columnVisibility.block && (
                          <td className="px-4 py-3 md:px-6 text-center" onClick={(e) => e.stopPropagation()}>
                            <BlockToggle
                              id={c._id}
                              type="customer"
                              blocked={!!c.blockedBySuperAdmin}
                              onSuccess={() => setCustomers((prev) => prev.map((x) => (x._id === c._id ? { ...x, blockedBySuperAdmin: !x.blockedBySuperAdmin } : x)))}
                            />
                          </td>
                        )}
                      </tr>
                      {expandedId === c._id && c.businessSpend && c.businessSpend.length > 0 && (
                        <tr key={`${c._id}-exp`} className="border-b border-slate-800/40 bg-slate-800/20">
                          <td colSpan={COLUMN_KEYS.filter((k) => columnVisibility[k]).length + 1} className="px-4 py-3 md:px-6">
                            <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
                              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-400">
                                <Store className="size-3.5" />
                                Spent per business
                              </p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="pb-2 text-left font-medium">Business</th>
                                    <th className="pb-2 text-left font-medium">City</th>
                                    <th className="pb-2 text-right font-medium">Spent</th>
                                    <th className="pb-2 text-right font-medium">Orders</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.businessSpend.map((b, i) => (
                                    <tr key={i} className="border-t border-slate-700/40 text-slate-300">
                                      <td className="py-1.5">{b.businessName}</td>
                                      <td className="py-1.5">{b.city ?? '—'}</td>
                                      <td className="py-1.5 text-right font-mono">{(b.totalSpent ?? 0).toFixed(2)} {c.totalSpentCurrency ?? 'ILS'}</td>
                                      <td className="py-1.5 text-right">{b.orderCount ?? 0}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
