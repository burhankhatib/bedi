'use client'

import { useState, useEffect, useRef } from 'react'
import { Megaphone, Loader2, Info, CheckCircle2, XCircle, Clock, MessageSquare, Send, RefreshCw, Smartphone, BellRing, Search, X } from 'lucide-react'
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
  channels?: string[]
  countries: string
  cities: string
  specificNumbers: string
  successfulNumbers?: string[]
  failedNumbers?: string[]
  sentCount: number
  failedCount: number
  fcmSentCount?: number
  fcmFailedCount?: number
  totalFound: number
  createdAt: string
}

export function AdminBroadcastClient({ initialTab = 'broadcast' }: { initialTab?: 'broadcast' | 'inbox' }) {
  const [targets, setTargets] = useState<string[]>([])
  const [countries, setCountries] = useState('')
  const [cities, setCities] = useState('')
  const [specificUsers, setSpecificUsers] = useState<{name: string, phone: string}[]>([])
  const [message, setMessage] = useState('')
  const [channels, setChannels] = useState<('whatsapp' | 'fcm')[]>(['whatsapp'])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success?: boolean, sentCount?: number, failedCount?: number, totalFound?: number, error?: string } | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<any>(null)
  const [preview, setPreview] = useState<{ totalFound: number; sample?: any[] } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  
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
  const [activeTab, setActiveTab] = useState<'broadcast' | 'inbox'>(initialTab)
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

  const toggleChannel = (c: 'whatsapp' | 'fcm') => {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  const fetchPreview = async () => {
    const validUsers = specificUsers.filter(u => u.name.trim() && u.phone.trim())
    if (targets.length === 0 && validUsers.length === 0) {
      setPreview(null)
      return
    }
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/admin/broadcast-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets,
          country: countries,
          city: cities,
          specificUsers: validUsers,
        })
      })
      if (res.ok) {
        const data = await res.json()
        setPreview(data)
      } else {
        setPreview(null)
      }
    } catch {
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (activeTab === 'broadcast') fetchPreview()
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [targets, countries, cities, specificUsers, activeTab])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (channels.length === 0) {
      alert('Please select at least one channel (WhatsApp or FCM).')
      return
    }
    const validUsers = specificUsers.filter(u => u.name.trim() && u.phone.trim())
    if (targets.length === 0 && validUsers.length === 0) {
      alert('Please select at least one target audience or enter specific users.')
      return
    }
    if (!message.trim()) {
      alert('Message cannot be empty.')
      return
    }

    const confirmMsg = `Are you sure you want to broadcast this message?\n\nChannels: ${channels.join(', ')}\nTargets: ${targets.join(', ') || 'None'}\nLocations: ${countries || 'All'} / ${cities || 'All'}\nSpecific Users: ${validUsers.length}\n\nMessage preview:\nمرحبا [Name]\n${message}\nهذه الرسالة اوتوماتيكية و لن يتم الرد عليها.`
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
          channels,
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

  const [countrySearch, setCountrySearch] = useState('')
  const [citySearch, setCitySearch] = useState('')

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

      <form onSubmit={handleSend} className="space-y-8 max-w-2xl pb-32 relative">

        {/* Sticky Summary Bar */}
        <div className="sticky top-4 z-10 bg-slate-900 border border-slate-700/60 rounded-xl p-4 shadow-xl flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">Broadcast Summary</h3>
            <p className="text-xs text-slate-400 mt-1">
              {previewLoading ? (
                <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Calculating audience...</span>
              ) : preview ? (
                <span>Sending to <strong className="text-amber-400">{preview.totalFound}</strong> recipient(s)</span>
              ) : (
                'Select targets to see preview'
              )}
            </p>
            {preview?.sample && preview.sample.length > 0 && (
              <p className="text-[10px] text-slate-500 mt-1 truncate">
                e.g., {preview.sample.map((s: any) => s.name).join(', ')}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={sending || (!preview && specificUsers.length === 0)}
            className="bg-amber-600 text-slate-950 hover:bg-amber-500 shrink-0 shadow-lg"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span className="ml-2 font-semibold">Send Broadcast</span>
          </Button>
        </div>
        
        {/* 1. Channels */}
        <div className="space-y-3 pt-2">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="flex items-center justify-center size-6 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">1</span>
            Channels
          </h3>
          <div className="flex flex-wrap gap-3 pl-8">
            <label className={`flex items-center gap-3 rounded-xl border ${channels.includes('whatsapp') ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700 bg-slate-800/50'} px-4 py-3 cursor-pointer hover:bg-slate-800 transition-colors flex-1 min-w-[200px]`}>
              <input
                type="checkbox"
                checked={channels.includes('whatsapp')}
                onChange={() => toggleChannel('whatsapp')}
                className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500/50 mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-white flex items-center gap-2">
                  <Smartphone className="size-4 text-emerald-400" /> WhatsApp
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Template message to phone</p>
              </div>
            </label>
            <label className={`flex items-center gap-3 rounded-xl border ${channels.includes('fcm') ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700 bg-slate-800/50'} px-4 py-3 cursor-pointer hover:bg-slate-800 transition-colors flex-1 min-w-[200px]`}>
              <input
                type="checkbox"
                checked={channels.includes('fcm')}
                onChange={() => toggleChannel('fcm')}
                className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500/50 mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-white flex items-center gap-2">
                  <BellRing className="size-4 text-blue-400" /> Web Push (FCM)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Notification to active apps</p>
              </div>
            </label>
          </div>
        </div>

        {/* 2. Target Audience */}
        <div className="space-y-3 pt-4 border-t border-slate-800/60">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="flex items-center justify-center size-6 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">2</span>
            Audiences
          </h3>
          <p className="text-xs text-slate-400 pl-8">Select broad groups to reach. You can skip this if only entering specific numbers below.</p>
          <div className="flex flex-wrap gap-3 pl-8">
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

        {/* 3. Location Filters */}
        <div className="space-y-3 pt-4 border-t border-slate-800/60">
          <div className="pl-8 -mt-2 mb-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 -ml-8">
              <span className="flex items-center justify-center size-6 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">3</span>
              Geography
            </h3>
            <p className="text-xs text-slate-400 mt-1">Leave empty to target all locations. Filter narrows down the Audiences selected above.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-8">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Countries</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 mb-2"
                />
              </div>
              
              {/* Selected Country Chips */}
              {countries && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {countries.split(',').map(s => s.trim()).filter(Boolean).map(c => (
                    <span key={c} className="inline-flex items-center gap-1 rounded bg-amber-500/10 text-amber-300 px-2 py-1 text-xs border border-amber-500/20">
                      {c}
                      <button type="button" onClick={() => toggleLocationFilter('country', c)} className="hover:text-amber-100 ml-1">
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 rounded-lg border border-slate-700 bg-slate-800/80 p-3">
                {availableCountries.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 ? (
                  <span className="text-xs text-slate-500">No matches found</span>
                ) : (
                  availableCountries
                    .filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()))
                    .map(c => {
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
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Cities</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search cities..."
                  value={citySearch}
                  onChange={e => setCitySearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 mb-2"
                />
              </div>

              {/* Selected City Chips */}
              {cities && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {cities.split(',').map(s => s.trim()).filter(Boolean).map(c => (
                    <span key={c} className="inline-flex items-center gap-1 rounded bg-amber-500/10 text-amber-300 px-2 py-1 text-xs border border-amber-500/20">
                      {c}
                      <button type="button" onClick={() => toggleLocationFilter('city', c)} className="hover:text-amber-100 ml-1">
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 rounded-lg border border-slate-700 bg-slate-800/80 p-3">
                {availableCities.filter(c => c.toLowerCase().includes(citySearch.toLowerCase())).length === 0 ? (
                  <span className="text-xs text-slate-500">No matches found</span>
                ) : (
                  availableCities
                    .filter(c => c.toLowerCase().includes(citySearch.toLowerCase()))
                    .map(c => {
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
        </div>

        {/* 4. Specific Users */}
        <div className="space-y-3 pt-4 border-t border-slate-800/60">
          <div className="flex items-center justify-between pl-8 -ml-8">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="flex items-center justify-center size-6 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">4</span>
              Specific Numbers
            </h3>
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
          <p className="text-xs text-slate-400 pl-8 -mt-2">Manually add individuals who will receive the message regardless of target filters. Phone must include country code.</p>
          
          <div className="pl-8">
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
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
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
          </div>
        </div>

        {/* 5. Message Content */}
        <div className="space-y-3 pt-4 border-t border-slate-800/60">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="flex items-center justify-center size-6 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">5</span>
            Message Content (Arabic)
          </h3>
          <div className="pl-8 space-y-1.5">
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
        </div>

        {/* Status / Result */}
        {jobStatus && jobId && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="size-4 animate-spin" />
              <p className="font-semibold">Broadcasting in background...</p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
              <div className="bg-amber-500 h-2 transition-all duration-300" style={{ width: `${jobStatus.totalFound ? ((jobStatus.sentCount + jobStatus.failedCount) / jobStatus.totalFound) * 100 : 0}%` }}></div>
            </div>
            <div className="flex gap-4">
              <p>WA Sent: {jobStatus.sentCount} | Failed: {jobStatus.failedCount}</p>
              {channels.includes('fcm') && <p className="border-l border-amber-500/30 pl-4">FCM Sent: {jobStatus.fcmSentCount || 0} | Failed: {jobStatus.fcmFailedCount || 0}</p>}
            </div>
            <p className="mt-1">Remaining to process: {Math.max(0, jobStatus.totalFound - (jobStatus.sentCount + jobStatus.failedCount))}</p>
          </div>
        )}
        {result && !jobId && (
          <div className={`rounded-lg border p-4 text-sm mt-4 ${result.error ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
            {result.error ? (
              <p>Error: {result.error}</p>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-emerald-400">Broadcast Completed!</p>
                <p>Found recipients: {result.totalFound}</p>
                <p>WA Successfully sent: {result.sentCount}</p>
                {result.failedCount ? <p className="text-amber-400">WA Failed to send: {result.failedCount}</p> : null}
                {channels.includes('fcm') && (
                  <>
                    <p className="text-blue-300 mt-2">FCM Successfully sent: {jobStatus?.fcmSentCount || 0}</p>
                    {jobStatus?.fcmFailedCount ? <p className="text-blue-400/80">FCM Failed: {jobStatus?.fcmFailedCount}</p> : null}
                  </>
                )}
              </div>
            )}
          </div>
        )}

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
                      {item.channels && item.channels.length > 0 && (
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded-full text-slate-300">
                          Channels: <span className="font-medium text-purple-400/90">{item.channels.join(', ')}</span>
                        </span>
                      )}
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
                    className="flex flex-col items-end gap-1 shrink-0 bg-slate-900/50 px-3 py-2 rounded-lg text-sm border border-slate-700/50 hover:bg-slate-800/80 transition-colors"
                  >
                    {(!item.channels || item.channels.includes('whatsapp')) && (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-400 w-6">WA</span>
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          <span className="font-medium">{item.sentCount || 0}</span>
                        </div>
                        {item.failedCount > 0 && (
                          <div className="flex items-center gap-1.5 text-rose-400 border-l border-slate-700 pl-3">
                            <XCircle className="size-3.5" />
                            <span className="font-medium">{item.failedCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {(item.channels?.includes('fcm')) && (
                      <div className="flex items-center gap-3 text-xs mt-1 border-t border-slate-700/50 pt-1 w-full justify-end">
                        <span className="text-slate-400 w-8">FCM</span>
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          <span className="font-medium">{item.fcmSentCount || 0}</span>
                        </div>
                        {item.fcmFailedCount !== undefined && item.fcmFailedCount > 0 && (
                          <div className="flex items-center gap-1.5 text-rose-400 border-l border-slate-700 pl-3">
                            <XCircle className="size-3.5" />
                            <span className="font-medium">{item.fcmFailedCount}</span>
                          </div>
                        )}
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

