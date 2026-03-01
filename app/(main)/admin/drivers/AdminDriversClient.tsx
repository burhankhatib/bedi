'use client'

import { useState, useEffect } from 'react'
import { Truck, Loader2, Edit } from 'lucide-react'
import { BlockToggle } from '@/components/admin/BlockToggle'
import { VerifyToggle } from '@/components/admin/VerifyToggle'
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

  useEffect(() => {
    fetch('/api/admin/drivers', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setDrivers(Array.isArray(data) ? data : []))
      .catch(() => setDrivers([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
        Loading…
      </div>
    )
  }

  if (drivers.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-12 text-center">
        <Truck className="mx-auto size-12 text-slate-600" />
        <p className="mt-4 text-slate-400">No drivers yet.</p>
      </div>
    )
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40">
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
            {drivers.map((d) => (
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
                  <Link
                    href={`/studio/structure/intent/edit/template=driver;type=driver;id=${d._id}`}
                    target="_blank"
                    className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-amber-400 transition-colors"
                    title="Edit in Studio"
                  >
                    <Edit className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
