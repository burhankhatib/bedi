'use client'

import { useState, useEffect, useRef } from 'react'
import { Megaphone, Loader2, Info, CheckCircle2, XCircle, Clock, MessageSquare, Send, RefreshCw } from 'lucide-react'
import { AdminWhatsAppPushBanner } from '@/components/AdminWhatsAppPushBanner'
import { Button } from '@/components/ui/button'

type WhatsAppMessage = {
  _id: string
  participantPhone: string
  direction: 'in' | 'out'
  text?: string
  messageType?: string
  createdAt?: string
}

type Conversation = {
  participantPhone: string
  lastMessageAt?: string
  lastMessagePreview: string
  messageCount: number
  messages: WhatsAppMessage[]
}

type BroadcastHistory = {
  _id: string
  message: string
  targets: string[]
  countries: string
  cities: string
    specificNumbers: string
    successfulNumbers?: string[]
    failedNumbers?: string[]
    sentCount: number
  failedCount: number
  totalFound: number
  createdAt: string
}

export function AdminBroadcastClient() {
  const [targets, setTargets] = useState<string[]>([])
  const [countries, setCountries] = useState('')
  const [cities, setCities] = useState('')
  const [specificUsers, setSpecificUsers] = useState<{name: string, phone: string}[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success?: boolean, sentCount?: number, failedCount?: number, totalFound?: number, error?: string } | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<any>(null)
  
  const [history, setHistory] = useState<BroadcastHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [availableCountries, setAvailableCountries] = useState<string[]>([])
  const [availableCities, setAvailableCities] = useState<string[]>([])

  const [contactSync, setContactSync] = useState<{
    syncedAtMs: number | null
    counts: { tenants: number; drivers: number; customersFromOrders: number; customersDirect: number } | null
  }>({ syncedAtMs: null, counts: null })
  const [syncingContacts, setSyncingContacts] = useState(false)

  // History filters
  const [filterDate, setFilterDate] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterTarget, setFilterTarget] = useState('')
  const [filterUser, setFilterUser] = useState('')

  // Expand state
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Inbox
  const [activeTab, setActiveTab] = useState<'broadcast' | 'inbox'>('broadcast')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchInbox = () => {
    setInboxLoading(true)
    fetch('/api/admin/whatsapp/inbox', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((data) => {
        setConversations(data.conversations ?? [])
        const sel = selectedConv
          ? (data.conversations ?? []).find((c: Conversation) => c.participantPhone === selectedConv.participantPhone)
          : null
        if (sel) setSelectedConv(sel)
      })
      .catch(() => setConversations([]))
      .finally(() => setInboxLoading(false))
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConv || !replyText.trim()) return
    setSendingReply(true)
    setReplyError(null)
    try {
      const res = await fetch('/api/admin/whatsapp/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: selectedConv.participantPhone, text: replyText.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setReplyText('')
        fetchInbox()
      } else {
        setReplyError(data.error ?? 'Failed to send')
      }
    } catch {
      setReplyError('Failed to send')
    } finally {
      setSendingReply(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'inbox') fetchInbox()
  }, [activeTab])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedConv?.messages])

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

  const fetchLocations = () => {
    fetch('/api/admin/broadcast-locations')
      .then(res => res.json())
      .then(data => {
        if (data.countries) setAvailableCountries(data.countries)
        if (data.cities) setAvailableCities(data.cities)
      })
      .catch(err => console.error(err))
  }

  const fetchContactSyncStatus = () => {
    fetch('/api/admin/broadcast-sync-contacts', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data && (data.syncedAtMs === null || typeof data.syncedAtMs === 'number')) {
          setContactSync({
            syncedAtMs: data.syncedAtMs,
            counts: data.counts ?? null,
          })
        }
      })
      .catch(() => {})
  }

  const handleSyncContacts = async () => {
    setSyncingContacts(true)
    try {
      const res = await fetch('/api/admin/broadcast-sync-contacts', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok && typeof data.syncedAtMs === 'number') {
        setContactSync({
          syncedAtMs: data.syncedAtMs,
          counts: data.counts ?? null,
        })
        fetchLocations()
      } else {
        alert(data.error || 'Sync failed')
      }
    } catch {
      alert('Sync failed')
    } finally {
      setSyncingContacts(false)
    }
  }

  useEffect(() => {
    fetchHistory()
    fetchLocations()
    fetchContactSyncStatus()
  }, [])

  const toggleTarget = (t: string) => {
    setTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const validUsers = specificUsers.filter(u => u.name.trim() && u.phone.trim())
    if (targets.length === 0 && validUsers.length === 0) {
      alert('Please select at least one target audience or enter specific users.')
      return
    }
    if (!message.trim()) {
      alert('Message cannot be empty.')
      return
    }

    const confirmMsg = `Are you sure you want to broadcast this message?\n\nTargets: ${targets.join(', ') || 'None'}\nLocations: ${countries || 'All'} / ${cities || 'All'}\nSpecific Users: ${validUsers.length}\n\nMessage preview:\nمرحبا [Name]\n${message}\nهذه الرسالة اوتوماتيكية و لن يتم الرد عليها.`
    if (!confirm(confirmMsg)) return

    setSending(true)
    setResult(null)
    setJobId(null)
    setJobStatus(null)

    try {
      const res = await fetch('/api/admin/broadcast-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets,
          country: countries, // Send directly to API which expects comma-separated
          city: cities,
          specificUsers: validUsers,
          message
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ error: data.error || 'Request failed' })
        setSending(false)
      } else {
        setJobId(data.jobId)
        setJobStatus({ totalFound: data.totalFound, sentCount: 0, failedCount: 0, status: 'pending' })
        setSpecificUsers([])
        setMessage('')
      }
    } catch (err: any) {
      setResult({ error: err.message || 'Error communicating with server' })
      setSending(false)
    }
  }

  useEffect(() => {
    if (!jobId) return
    let timeoutId: any
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/broadcast-jobs/${jobId}`)
        if (res.ok) {
          const data = await res.json()
          setJobStatus(data)
          if (data.status === 'done' || data.status === 'failed') {
            setSending(false)
            setJobId(null)
            setResult({
              success: true,
              totalFound: data.totalFound,
              sentCount: data.sentCount,
              failedCount: data.failedCount,
              error: data.status === 'failed' ? 'Job failed' : undefined
            })
            fetchHistory()
            return
          }
        }
      } catch (e) {
        console.error(e)
      }
      timeoutId = setTimeout(poll, 2000)
    }
    poll()
    return () => clearTimeout(timeoutId)
  }, [jobId])

  const toggleLocationFilter = (type: 'country' | 'city', val: string) => {
    if (type === 'country') {
      const arr = countries.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      const valLower = val.toLowerCase()
      if (arr.includes(valLower)) {
        setCountries(arr.filter(x => x !== valLower).join(', '))
      } else {
        setCountries([...arr, valLower].join(', '))
      }
    } else {
      const arr = cities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      const valLower = val.toLowerCase()
      if (arr.includes(valLower)) {
        setCities(arr.filter(x => x !== valLower).join(', '))
      } else {
        setCities([...arr, valLower].join(', '))
      }
    }
  }

  const filteredHistory = history.filter(item => {
    let match = true
    if (filterDate) {
      const itemDate = new Date(item.createdAt).toISOString().split('T')[0]
      if (itemDate !== filterDate) match = false
    }
    if (filterCountry) {
      const cArr = (item.countries || '').split(',').map(s => s.trim().toLowerCase())
      if (!cArr.includes(filterCountry.toLowerCase())) match = false
    }
    if (filterCity) {
      const cArr = (item.cities || '').split(',').map(s => s.trim().toLowerCase())
      if (!cArr.includes(filterCity.toLowerCase())) match = false
    }
    if (filterTarget && (!item.targets || !item.targets.includes(filterTarget))) match = false
    if (filterUser && item.specificNumbers && !item.specificNumbers.toLowerCase().includes(filterUser.toLowerCase())) match = false
    return match
  })

  return (
    <div className="mt-6">
      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('broadcast')}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'broadcast'
              ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
              : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'
          }`}
        >
          <Megaphone className="size-4" />
          Broadcast
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'inbox'
              ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
              : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'
          }`}
        >
          <MessageSquare className="size-4" />
          Inbox
        </button>
      </div>

      {activeTab === 'inbox' ? (
        /* Inbox chat layout */
        <div className="space-y-4">
          <AdminWhatsAppPushBanner />
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden" style={{ minHeight: 520 }}>
          <div className="flex h-[520px]">
            {/* Conversation list */}
            <div className="w-72 shrink-0 border-r border-slate-700/60 flex flex-col bg-slate-900/60">
              <div className="p-4 border-b border-slate-700/60 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">Conversations</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Messages received on your WhatsApp Business number</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchInbox()}
                  disabled={inboxLoading}
                  className="p-2 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-800/60 hover:text-white transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`size-4 ${inboxLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {inboxLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="size-6 animate-spin text-slate-400" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No conversations yet. Messages will appear here when users message your WhatsApp Business number.</p>
                ) : (
                  <div className="divide-y divide-slate-700/40">
                    {conversations.map((c) => (
                      <button
                        key={c.participantPhone}
                        type="button"
                        onClick={() => { setSelectedConv(c); setReplyError(null) }}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors ${
                          selectedConv?.participantPhone === c.participantPhone
                            ? 'bg-amber-500/10 border-l-2 border-amber-500 -ml-px pl-[15px]'
                            : ''
                        }`}
                      >
                        <div className="font-medium text-white truncate" dir="ltr">+{c.participantPhone}</div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{c.lastMessagePreview || 'No messages'}</p>
                        {c.lastMessageAt && (
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(c.lastMessageAt).toLocaleString()}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-w-0">
              {selectedConv ? (
                <>
                  <div className="p-4 border-b border-slate-700/60 bg-slate-800/30">
                    <h3 className="font-medium text-white" dir="ltr">+{selectedConv.participantPhone}</h3>
                    <p className="text-xs text-slate-400">{selectedConv.messageCount} messages</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {selectedConv.messages.map((m) => (
                      <div
                        key={m._id}
                        className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                            m.direction === 'out'
                              ? 'bg-amber-600/80 text-slate-950 rounded-br-md'
                              : 'bg-slate-700/80 text-white rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words" dir="auto">{m.text || '[Media]'}</p>
                          <p className={`text-[10px] mt-1 ${m.direction === 'out' ? 'text-slate-700' : 'text-slate-400'}`}>
                            {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <form onSubmit={handleSendReply} className="p-4 border-t border-slate-700/60 bg-slate-900/60">
                    {replyError && (
                      <p className="text-sm text-red-400 mb-2">{replyError}</p>
                    )}
                    <p className="text-xs text-slate-500 mb-2">Replies work within 24h of the user&apos;s last message. Outside that window, use a pre-approved template.</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        dir="auto"
                      />
                      <Button
                        type="submit"
                        disabled={!replyText.trim() || sendingReply}
                        className="bg-amber-600 text-slate-950 hover:bg-amber-500 shrink-0"
                      >
                        {sendingReply ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <MessageSquare className="size-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a conversation to view messages and reply</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      ) : (
        /* Broadcast tab */
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
      <div className="mb-6 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">Contact list (cached in Firebase)</p>
            <p className="text-xs text-slate-400 mt-1">
              Broadcasts read from this cache only — no Sanity API per send. Sync after you change tenants, drivers, or customers in the CMS.
            </p>
            {contactSync.syncedAtMs != null ? (
              <p className="text-xs text-emerald-400/90 mt-2">
                Last synced: {new Date(contactSync.syncedAtMs).toLocaleString()}
                {contactSync.counts && (
                  <span className="text-slate-500 ml-2">
                    ({contactSync.counts.tenants} businesses · {contactSync.counts.drivers} drivers ·{' '}
                    {contactSync.counts.customersDirect} direct customers · {contactSync.counts.customersFromOrders}{' '}
                    order rows)
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-amber-400/90 mt-2">Not synced yet — run sync before your first broadcast.</p>
            )}
          </div>
          <Button
            type="button"
            onClick={() => void handleSyncContacts()}
            disabled={syncingContacts}
            className="shrink-0 bg-slate-700 text-white hover:bg-slate-600 border border-slate-600"
          >
            {syncingContacts ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            <span className="ml-2">Sync contacts from CMS</span>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSend} className="space-y-6 max-w-2xl">
        
        {/* Target Audience */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">Target Audience (Optional if using specific users)</label>
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
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">Country Filters (Optional)</label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 rounded-lg border border-slate-700 bg-slate-800/80 p-3">
              {availableCountries.length === 0 ? (
                <span className="text-xs text-slate-500">No countries found</span>
              ) : (
                availableCountries.map(c => {
                  const isChecked = countries.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(c.toLowerCase())
                  return (
                    <label key={c} className="flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-2 py-1 cursor-pointer hover:bg-slate-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleLocationFilter('country', c)}
                        className="rounded border-slate-500 bg-slate-900 text-amber-500 focus:ring-amber-500/50"
                      />
                      <span className="text-xs font-medium text-slate-300">{c}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">City Filters (Optional)</label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 rounded-lg border border-slate-700 bg-slate-800/80 p-3">
              {availableCities.length === 0 ? (
                <span className="text-xs text-slate-500">No cities found</span>
              ) : (
                availableCities.map(c => {
                  const isChecked = cities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(c.toLowerCase())
                  return (
                    <label key={c} className="flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-2 py-1 cursor-pointer hover:bg-slate-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleLocationFilter('city', c)}
                        className="rounded border-slate-500 bg-slate-900 text-amber-500 focus:ring-amber-500/50"
                      />
                      <span className="text-xs font-medium text-slate-300">{c}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 flex items-start gap-1.5">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          Leave location filters empty to send to everyone in the selected target groups. Customers are filtered based on the cities/countries of the businesses they ordered from.
        </p>

        {/* Specific Users */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-300">Specific Users (Optional)</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSpecificUsers([...specificUsers, { name: '', phone: '' }])}
              className="h-8 border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-300 text-xs"
            >
              + Add User
            </Button>
          </div>
          {specificUsers.length > 0 && (
            <div className="space-y-2">
              {specificUsers.map((u, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={u.name}
                    onChange={e => {
                      const newArr = [...specificUsers]
                      newArr[i].name = e.target.value
                      setSpecificUsers(newArr)
                    }}
                    placeholder="First Name"
                    className="w-1/3 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                  <input
                    type="text"
                    value={u.phone}
                    onChange={e => {
                      const newArr = [...specificUsers]
                      newArr[i].phone = e.target.value
                      setSpecificUsers(newArr)
                    }}
                    placeholder="Phone (e.g. +972...)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newArr = [...specificUsers]
                      newArr.splice(i, 1)
                      setSpecificUsers(newArr)
                    }}
                    className="p-2 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                    title="Remove user"
                  >
                    <XCircle className="size-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">Add individuals to receive the broadcast. Phone must include country code.</p>
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
        {jobStatus && jobId && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="size-4 animate-spin" />
              <p className="font-semibold">Broadcasting in background...</p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
              <div className="bg-amber-500 h-2 transition-all duration-300" style={{ width: `${jobStatus.totalFound ? ((jobStatus.sentCount + jobStatus.failedCount) / jobStatus.totalFound) * 100 : 0}%` }}></div>
            </div>
            <p>Sent: {jobStatus.sentCount} | Failed: {jobStatus.failedCount} | Remaining: {Math.max(0, jobStatus.totalFound - (jobStatus.sentCount + jobStatus.failedCount))}</p>
          </div>
        )}
        {result && !jobId && (
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
          disabled={sending || (targets.length === 0 && specificUsers.filter(u => u.name.trim() && u.phone.trim()).length === 0) || !message.trim()} 
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-white">Broadcast History</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            <select
              value={filterCountry}
              onChange={e => setFilterCountry(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              <option value="">All Countries</option>
              {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              <option value="">All Cities</option>
              {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterTarget}
              onChange={e => setFilterTarget(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              <option value="">All Categories</option>
              <option value="businesses">Businesses</option>
              <option value="drivers">Drivers</option>
              <option value="customers">Customers</option>
            </select>
            <input
              type="text"
              placeholder="Search specific user..."
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            {(filterDate || filterCountry || filterCity || filterTarget || filterUser) && (
              <button
                onClick={() => {
                  setFilterDate('')
                  setFilterCountry('')
                  setFilterCity('')
                  setFilterTarget('')
                  setFilterUser('')
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loadingHistory ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Loading history...
          </div>
        ) : filteredHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No broadcast history found matching filters.</p>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map(item => (
              <div key={item._id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 transition-colors hover:bg-slate-800/40">
                <div className="flex flex-col sm:flex-row justify-between gap-3 items-start mb-3">
                  <div className="space-y-1">
                    <p className="text-sm text-white line-clamp-2" dir="rtl">{item.message}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                      {item.targets && item.targets.length > 0 && (
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded-full text-slate-300">
                          Targets: <span className="font-medium text-amber-500/90">{item.targets.join(', ')}</span>
                        </span>
                      )}
                      {(item.countries || item.cities) && (
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded-full text-slate-300">
                          Loc: <span className="font-medium text-sky-400/90">{item.countries || 'All'} / {item.cities || 'All'}</span>
                        </span>
                      )}
                      {item.specificNumbers && (
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded-full max-w-[150px] sm:max-w-[300px] truncate text-slate-300" title={item.specificNumbers}>
                          Specific: <span className="font-medium text-emerald-400/90">{item.specificNumbers}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => setExpandedId(expandedId === item._id ? null : item._id)}
                    className="flex items-center gap-3 shrink-0 bg-slate-900/50 px-3 py-2 rounded-lg text-sm border border-slate-700/50 hover:bg-slate-800/80 transition-colors"
                  >
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
                  </button>
                </div>

                {/* Expanded Details */}
                {expandedId === item._id && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <h4 className="font-medium text-emerald-400 flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="size-3.5" /> 
                        Successfully Sent ({item.successfulNumbers?.length || 0})
                      </h4>
                      <div className="bg-slate-900/40 border border-emerald-900/30 rounded-lg p-2 max-h-40 overflow-y-auto">
                        {item.successfulNumbers && item.successfulNumbers.length > 0 ? (
                          <ul className="space-y-1">
                            {item.successfulNumbers.map((num, i) => (
                              <li key={i} className="text-slate-300 px-2 py-1 bg-slate-800/30 rounded">{num}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-500 italic p-2">No data available.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-rose-400 flex items-center gap-1.5 mb-2">
                        <XCircle className="size-3.5" /> 
                        Failed ({item.failedNumbers?.length || 0})
                      </h4>
                      <div className="bg-slate-900/40 border border-rose-900/30 rounded-lg p-2 max-h-40 overflow-y-auto">
                        {item.failedNumbers && item.failedNumbers.length > 0 ? (
                          <ul className="space-y-1">
                            {item.failedNumbers.map((num, i) => (
                              <li key={i} className="text-slate-300 px-2 py-1 bg-slate-800/30 rounded">{num}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-500 italic p-2">No failed messages.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  )
}

