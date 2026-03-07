'use client'

import { useState, useEffect } from 'react'
import { Truck, Loader2, Edit, UserMinus, MessageCircle } from 'lucide-react'
import { BlockToggle } from '@/components/admin/BlockToggle'
import { VerifyToggle } from '@/components/admin/VerifyToggle'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type Driver = {
  _id: string
  name?: string
  phoneNumber?: string
  country?: string
  city?: string
  isOnline?: boolean
  vehicleType?: string
  isVerifiedByAdmin?: boolean
  blockedBySuperAdmin?: boolean
}

export function AdminDriversClient() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [driverToUnassign, setDriverToUnassign] = useState<Driver | null>(null)
  const [reassignToId, setReassignToId] = useState('')
  const [unassignLoading, setUnassignLoading] = useState(false)
  const [unassignMessage, setUnassignMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testingWa, setTestingWa] = useState<string | null>(null)

  // Filters
  const [searchName, setSearchName] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'online', 'offline'

  useEffect(() => {
    fetch('/api/admin/drivers', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setDrivers(Array.isArray(data) ? data : []))
      .catch(() => setDrivers([]))
      .finally(() => setLoading(false))
  }, [])

  const handleUnassignSubmit = async () => {
    if (!driverToUnassign) return
    setUnassignLoading(true)
    setUnassignMessage(null)
    try {
      const res = await fetch(`/api/admin/drivers/${driverToUnassign._id}/unassign-from-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(reassignToId ? { reassignTo: reassignToId } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setUnassignMessage({ type: 'error', text: data?.error || 'Failed to unassign' })
        return
      }
      setUnassignMessage({
        type: 'success',
        text: data?.message ?? `Unassigned from ${data?.updated ?? 0} order(s). You can now delete the driver in Sanity Studio.`,
      })
      setReassignToId('')
      setTimeout(() => {
        setDriverToUnassign(null)
        setUnassignMessage(null)
      }, 2500)
    } catch {
      setUnassignMessage({ type: 'error', text: 'Request failed' })
    } finally {
      setUnassignLoading(false)
    }
  }

  const handleTestWhatsApp = async (d: Driver) => {
    let phoneToUse = d.phoneNumber
    if (!phoneToUse) {
      phoneToUse = prompt(`Enter phone number to test WhatsApp for ${d.name || 'this driver'}:`) || ''
      if (!phoneToUse) return
    } else {
      if (!confirm(`Send test WhatsApp to ${d.name || 'this driver'} (${phoneToUse})?`)) return
    }

    setTestingWa(d._id)
    try {
      const res = await fetch('/api/admin/test-whatsapp-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneToUse })
      })
      const data = await res.json()
      if (res.ok) {
        alert('✅ WhatsApp message sent successfully!')
      } else {
        const errorDetails = data.details?.error?.message || data.details?.message || JSON.stringify(data.details || data)
        const moreDetails = data.details?.error?.error_data?.details || ''
        console.error('WhatsApp Test Error:', data.details || errorDetails)
        alert(`❌ Failed to send:\n${errorDetails}\n${moreDetails}`)
      }
    } catch (err) {
      console.error(err)
      alert('❌ Error sending WhatsApp message')
    } finally {
      setTestingWa(null)
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

  const uniqueCountries = Array.from(new Set(drivers.map(d => (d.country || '').trim()).filter(Boolean))).sort()
  const uniqueCities = Array.from(new Set(drivers.map(d => (d.city || '').trim()).filter(Boolean))).sort()

  const filteredDrivers = drivers
    .filter((d) => {
      // Name Search
      if (searchName && !(d.name || '').toLowerCase().includes(searchName.toLowerCase())) return false
      
      // Country Filter
      if (filterCountry && (d.country || '').trim() !== filterCountry) return false
      
      // City Filter
      if (filterCity && (d.city || '').trim() !== filterCity) return false
      
      // Status Filter
      if (filterStatus === 'online' && !d.isOnline) return false
      if (filterStatus === 'offline' && d.isOnline) return false

      return true
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  return (
    <div className="space-y-6 mt-6">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60">
        <input 
          type="text" 
          placeholder="Search by name..." 
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 flex-1 sm:min-w-[200px]"
        />
        
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">All Countries</option>
          {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">All Cities</option>
          {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="all">All Statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>

        {(searchName || filterCountry || filterCity || filterStatus !== 'all') && (
          <button
            onClick={() => {
              setSearchName('')
              setFilterCountry('')
              setFilterCity('')
              setFilterStatus('all')
            }}
            className="text-sm text-slate-400 hover:text-white px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {filteredDrivers.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-12 text-center">
          <Truck className="mx-auto size-12 text-slate-600" />
          <p className="mt-4 text-slate-400">No drivers found matching filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-400">
                  <th className="px-4 py-3 font-medium md:px-6">Name</th>
                  <th className="px-4 py-3 font-medium md:px-6">Phone</th>
                  <th className="hidden px-4 py-3 font-medium md:px-6 md:table-cell">Location</th>
                  <th className="px-4 py-3 font-medium md:px-6">Vehicle</th>
                  <th className="px-4 py-3 font-medium md:px-6">Status</th>
                  <th className="px-4 py-3 font-medium md:px-6 text-center">Verified</th>
                  <th className="px-4 py-3 font-medium md:px-6 text-center">Block</th>
                  <th className="px-4 py-3 font-medium md:px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((d) => (
                  <tr key={d._id} className={`border-b border-slate-800/40 hover:bg-slate-800/30 ${d.blockedBySuperAdmin ? 'opacity-80' : ''}`}>
                <td className="px-4 py-3 md:px-6 font-medium">{d.name ?? '—'}</td>
                <td className="px-4 py-3 md:px-6 font-mono text-slate-400">{d.phoneNumber ?? '—'}</td>
                <td className="hidden px-4 py-3 md:px-6 text-slate-400 md:table-cell">
                  {[d.city, d.country].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 md:px-6 text-slate-400">{d.vehicleType ?? '—'}</td>
                <td className="px-4 py-3 md:px-6">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${d.isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
                    {d.isOnline ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="px-4 py-3 md:px-6 text-center">
                  <VerifyToggle id={d._id} verified={!!d.isVerifiedByAdmin} onSuccess={() => setDrivers((prev) => prev.map((x) => (x._id === d._id ? { ...x, isVerifiedByAdmin: !x.isVerifiedByAdmin } : x)))} />
                </td>
                <td className="px-4 py-3 md:px-6 text-center">
                  <BlockToggle id={d._id} type="driver" blocked={!!d.blockedBySuperAdmin} onSuccess={() => setDrivers((prev) => prev.map((x) => (x._id === d._id ? { ...x, blockedBySuperAdmin: !x.blockedBySuperAdmin } : x)))} />
                </td>
                <td className="px-4 py-3 md:px-6 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleTestWhatsApp(d)}
                      disabled={testingWa === d._id}
                      className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-50"
                      title="Test WhatsApp Notification"
                    >
                      {testingWa === d._id ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDriverToUnassign(d)
                        setReassignToId('')
                        setUnassignMessage(null)
                      }}
                      className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-amber-400 transition-colors"
                      title="Unassign from all orders (then delete in Studio)"
                    >
                      <UserMinus className="size-4" />
                    </button>
                    <Link
                      href={`/studio/structure/intent/edit/template=driver;type=driver;id=${d._id}`}
                      target="_blank"
                      className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-amber-400 transition-colors"
                      title="Edit in Studio"
                    >
                      <Edit className="size-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
      )}

      <Dialog open={!!driverToUnassign} onOpenChange={(open) => !open && setDriverToUnassign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign {driverToUnassign?.name ?? 'driver'} from all orders?</DialogTitle>
            <DialogDescription>
              This will remove this driver from every order that references them. You can then delete the driver in Sanity Studio.
              Optionally reassign those orders to another driver below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-300">Reassign to (optional)</label>
            <select
              value={reassignToId}
              onChange={(e) => setReassignToId(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">— Unassign only (no reassign) —</option>
              {drivers
                .filter((x) => x._id !== driverToUnassign?._id)
                .map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name ?? x._id} {x.phoneNumber ? ` · ${x.phoneNumber}` : ''}
                  </option>
                ))}
            </select>
          </div>
          {unassignMessage && (
            <p className={`text-sm ${unassignMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {unassignMessage.text}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDriverToUnassign(null)} disabled={unassignLoading}>
              Cancel
            </Button>
            <Button onClick={handleUnassignSubmit} disabled={unassignLoading}>
              {unassignLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Unassigning…
                </>
              ) : reassignToId ? (
                'Unassign and reassign'
              ) : (
                'Unassign from all orders'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
