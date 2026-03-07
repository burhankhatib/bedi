'use client'

import { useState, useEffect } from 'react'
import { Megaphone, Loader2, Info, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BroadcastHistory = {
  _id: string
  message: string
  targets: string[]
  countries: string
  cities: string
  specificNumbers: string
  sentCount: number
  failedCount: number
  totalFound: number
  createdAt: string
}

export function AdminBroadcastClient() {
  const [targets, setTargets] = useState<string[]>([])
  const [countries, setCountries] = useState('')
  const [cities, setCities] = useState('')
  const [specificNumbers, setSpecificNumbers] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success?: boolean, sentCount?: number, failedCount?: number, totalFound?: number, error?: string } | null>(null)
  
  const [history, setHistory] = useState<BroadcastHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const fetchHistory = () => {
    setLoadingHistory(true)
    fetch('/api/admin/broadcast-history')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHistory(data)
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingHistory(false))
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const toggleTarget = (t: string) => {
    setTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (targets.length === 0 && !specificNumbers.trim()) {
      alert('Please select at least one target audience or enter specific numbers.')
      return
    }
    if (!message.trim()) {
      alert('Message cannot be empty.')
      return
    }

    const confirmMsg = `Are you sure you want to broadcast this message?\n\nTargets: ${targets.join(', ') || 'None'}\nLocations: ${countries || 'All'} / ${cities || 'All'}\nSpecific Numbers: ${specificNumbers ? 'Yes' : 'No'}\n\nMessage preview:\nمرحبا [Name]\n${message}\nهذه الرسالة اوتوماتيكية و لن يتم الرد عليها.`
    if (!confirm(confirmMsg)) return

    setSending(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/broadcast-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets,
          country: countries,
          city: cities,
          specificNumbers,
          message
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ error: data.error || 'Request failed' })
      } else {
        setResult(data)
        setSpecificNumbers('')
        setMessage('')
        fetchHistory()
      }
    } catch (err: any) {
      setResult({ error: err.message || 'Error communicating with server' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
      <form onSubmit={handleSend} className="space-y-6 max-w-2xl">
        
        {/* Target Audience */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">Target Audience (Optional if using specific numbers)</label>
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'businesses', label: 'Businesses' },
              { id: 'drivers', label: 'Drivers' },
              { id: 'customers', label: 'Customers' }
            ].map(t => (
              <label key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={targets.includes(t.id)}
                  onChange={() => toggleTarget(t.id)}
                  className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500/50"
                />
                <span className="text-sm font-medium text-white">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Location Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Country Filters (Optional)</label>
            <input
              type="text"
              value={countries}
              onChange={e => setCountries(e.target.value)}
              placeholder="e.g. PS, IL (comma separated)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">City Filters (Optional)</label>
            <input
              type="text"
              value={cities}
              onChange={e => setCities(e.target.value)}
              placeholder="e.g. Ramallah, Nablus"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 flex items-start gap-1.5">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          Leave location filters empty to send to everyone in the selected target groups. Customers are filtered based on the cities/countries of the businesses they ordered from.
        </p>

        {/* Specific Numbers */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">Specific Phone Numbers (Optional)</label>
          <textarea
            value={specificNumbers}
            onChange={e => setSpecificNumbers(e.target.value)}
            rows={2}
            placeholder="e.g. +972501234567, +970591234567 (comma separated)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
          <p className="text-xs text-slate-500">Includes country code. Useful for testing or reaching specific individuals.</p>
        </div>

        {/* Message Content */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">Message Content (Arabic)</label>
          <div className="rounded-lg border border-slate-700 bg-slate-800/80 overflow-hidden text-sm">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700/50 text-slate-400 font-mono" dir="rtl">
              مرحبا {'{{1}}'}
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              rows={4}
              dir="rtl"
              placeholder="اكتب رسالتك هنا..."
              className="w-full resize-y bg-transparent px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none"
            />
            <div className="bg-slate-800/50 px-4 py-2 border-t border-slate-700/50 text-slate-400 font-mono" dir="rtl">
              هذه الرسالة اوتوماتيكية و لن يتم الرد عليها.
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {`{{1}}`} will automatically be replaced with the recipient's first name. Your input here will replace {`{{2}}`}.
          </p>
        </div>

        {/* Status / Result */}
        {result && (
          <div className={`rounded-lg border p-4 text-sm ${result.error ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
            {result.error ? (
              <p>Error: {result.error}</p>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-emerald-400">Broadcast Completed!</p>
                <p>Found recipients: {result.totalFound}</p>
                <p>Successfully sent: {result.sentCount}</p>
                {result.failedCount ? <p className="text-amber-400">Failed to send: {result.failedCount}</p> : null}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <Button 
          type="submit" 
          disabled={sending || (targets.length === 0 && !specificNumbers.trim()) || !message.trim()} 
          className="w-full sm:w-auto bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold"
        >
          {sending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Broadcasting...
            </>
          ) : (
            <>
              <Megaphone className="mr-2 size-4" />
              Send Broadcast
            </>
          )}
        </Button>
      </form>

      {/* Broadcast History */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold text-white mb-4">Broadcast History</h2>
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">No broadcast history found.</p>
        ) : (
          <div className="space-y-4">
            {history.map(item => (
              <div key={item._id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                <div className="flex flex-col sm:flex-row justify-between gap-3 items-start mb-3">
                  <div className="space-y-1">
                    <p className="text-sm text-white line-clamp-2" dir="rtl">{item.message}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                      {item.targets && item.targets.length > 0 && (
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded-full">
                          Targets: {item.targets.join(', ')}
                        </span>
                      )}
                      {(item.countries || item.cities) && (
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded-full">
                          Loc: {item.countries || 'All'} / {item.cities || 'All'}
                        </span>
                      )}
                      {item.specificNumbers && (
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded-full max-w-[150px] truncate" title={item.specificNumbers}>
                          Specific: {item.specificNumbers}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 bg-slate-900/50 px-3 py-2 rounded-lg text-sm border border-slate-700/50">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="size-4" />
                      <span className="font-medium">{item.sentCount || 0}</span>
                    </div>
                    {item.failedCount > 0 && (
                      <div className="flex items-center gap-1.5 text-rose-400 border-l border-slate-700 pl-3">
                        <XCircle className="size-4" />
                        <span className="font-medium">{item.failedCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

