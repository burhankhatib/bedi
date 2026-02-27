'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Check, Volume2, VolumeX, HandHelping, CreditCard, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface NewOrder {
  _id: string
  orderNumber: string
  createdAt: string
}

export interface TableRequest {
  _id: string
  orderNumber: string
  tableNumber?: string
  customerRequestType?: 'call_waiter' | 'request_check'
  customerRequestPaymentMethod?: 'cash' | 'card'
  customerRequestedAt?: string
}

export interface StandaloneTableRequest {
  _id: string
  tableNumber: string
  type: string
  createdAt: string
}

interface OrderNotificationsProps {
  onAcknowledge: (orderId: string) => void
  onAcknowledgeTableRequest?: (orderId: string) => void
  onAcknowledgeStandaloneTableRequest?: (id: string) => void
  initialNewOrders?: NewOrder[]
  initialTableRequests?: TableRequest[]
  initialStandaloneTableRequests?: StandaloneTableRequest[]
  /** When provided (e.g. tenant page), use this sound so it works without fetching global restaurantInfo */
  initialNotificationSound?: string
}

export function OrderNotifications({
  onAcknowledge,
  onAcknowledgeTableRequest,
  onAcknowledgeStandaloneTableRequest,
  initialNewOrders = [],
  initialTableRequests = [],
  initialStandaloneTableRequests = [],
  initialNotificationSound: initialSound,
}: OrderNotificationsProps) {
  const [newOrders, setNewOrders] = useState<Array<{ _id: string; orderNumber: string }>>(initialNewOrders)
  const [tableRequests, setTableRequests] = useState<TableRequest[]>(initialTableRequests)
  const [standaloneTableRequests, setStandaloneTableRequests] = useState<StandaloneTableRequest[]>(initialStandaloneTableRequests)
  const [notificationSound, setNotificationSound] = useState<string>(initialSound ?? '1.wav')
  const [volume, setVolume] = useState<number>(1.0)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [soundBlocked, setSoundBlocked] = useState<boolean>(false)
  const totalAlerts = newOrders.length + tableRequests.length + standaloneTableRequests.length
  const previousCountRef = useRef<number>(initialNewOrders.length + initialTableRequests.length + initialStandaloneTableRequests.length)
  const isAcknowledgingRef = useRef<string | null>(null)
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (initialSound) {
      setNotificationSound(initialSound)
      return
    }
    // Fetch the selected notification sound from restaurant info (global orders page)
    const fetchNotificationSound = async () => {
      try {
        console.log('[OrderNotifications] Fetching notification sound setting...')
        const { client } = await import('@/sanity/lib/client')
        const query = `*[_type == "restaurantInfo"][0].notificationSound`
        const sound = await client.fetch(query)
        if (sound) {
          console.log('[OrderNotifications] Notification sound set to:', sound)
          setNotificationSound(sound)
        } else {
          console.log('[OrderNotifications] No notification sound found, using default: 1.wav')
          setNotificationSound('1.wav')
        }
      } catch (error) {
        console.error('[OrderNotifications] Error fetching notification sound:', error)
        setNotificationSound('1.wav')
      }
    }

    fetchNotificationSound()
  }, [initialSound])

  // Update newOrders, tableRequests, standaloneTableRequests when props change (from live refetch)
  useEffect(() => {
    if (!isAcknowledgingRef.current) {
      const currentTotal = initialNewOrders.length + initialTableRequests.length + initialStandaloneTableRequests.length
      previousCountRef.current = currentTotal
      setNewOrders(initialNewOrders)
      setTableRequests(initialTableRequests)
      setStandaloneTableRequests(initialStandaloneTableRequests)
    }
  }, [initialNewOrders, initialTableRequests, initialStandaloneTableRequests])

  // Notification as trigger: play sound when there are new orders OR table requests
  useEffect(() => {
    if (totalAlerts === 0) {
      setSoundBlocked(false)
      if (notificationAudioRef.current) {
        notificationAudioRef.current.pause()
        notificationAudioRef.current.currentTime = 0
        notificationAudioRef.current = null
      }
      return
    }

    setSoundBlocked(false)
    const soundFile = notificationSound || '1.wav'
    const src = `/sounds/${soundFile}`

    // Create a new Audio instance when notification arrives - the arrival is the trigger
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = isMuted ? 0 : volume
    notificationAudioRef.current = audio

    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {})
        .catch(() => setSoundBlocked(true))
    }

    return () => {
      audio.pause()
      audio.currentTime = 0
      if (notificationAudioRef.current === audio) {
        notificationAudioRef.current = null
      }
    }
  }, [totalAlerts, notificationSound, volume, isMuted])

  // Update volume when slider changes
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (notificationAudioRef.current) {
      notificationAudioRef.current.volume = isMuted ? 0 : newVolume
    }
  }

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (notificationAudioRef.current) {
      notificationAudioRef.current.volume = !isMuted ? 0 : volume
    }
  }

  // Show browser notification when alerts increase
  useEffect(() => {
    if (totalAlerts > 0 && previousCountRef.current < totalAlerts) {
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('🔔 Order alert', {
            body: totalAlerts === 1
              ? '1 new order or table request'
              : `${totalAlerts} new orders or table requests`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
          })
        } catch (_) {}
      } else if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [totalAlerts])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleAcknowledge = async (orderId: string) => {
    try {
      isAcknowledgingRef.current = orderId
      setNewOrders((prev) => prev.filter((o) => o._id !== orderId))
      await onAcknowledge(orderId)
      setTimeout(() => { isAcknowledgingRef.current = null }, 1000)
    } catch (error) {
      console.error('[OrderNotifications] Error acknowledging order:', error)
      isAcknowledgingRef.current = null
      alert('Failed to acknowledge order. Please try again.')
    }
  }

  const handleAcknowledgeTableRequest = async (orderId: string) => {
    if (!onAcknowledgeTableRequest) return
    try {
      isAcknowledgingRef.current = orderId
      setTableRequests((prev) => prev.filter((o) => o._id !== orderId))
      await onAcknowledgeTableRequest(orderId)
      setTimeout(() => { isAcknowledgingRef.current = null }, 1000)
    } catch (error) {
      console.error('[OrderNotifications] Error acknowledging table request:', error)
      isAcknowledgingRef.current = null
      alert('Failed to acknowledge table request. Please try again.')
    }
  }

  const handleAcknowledgeStandaloneTableRequest = async (id: string) => {
    if (!onAcknowledgeStandaloneTableRequest) return
    try {
      isAcknowledgingRef.current = id
      setStandaloneTableRequests((prev) => prev.filter((r) => r._id !== id))
      await onAcknowledgeStandaloneTableRequest(id)
      setTimeout(() => { isAcknowledgingRef.current = null }, 1000)
    } catch (error) {
      console.error('[OrderNotifications] Error acknowledging standalone table request:', error)
      isAcknowledgingRef.current = null
      alert('Failed to acknowledge. Please try again.')
    }
  }

  // Keep notification audio volume in sync when volume/mute change
  useEffect(() => {
    if (notificationAudioRef.current) {
      notificationAudioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  if (totalAlerts === 0) {
    return null
  }

  return (
    <>
      {/* Volume controls — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-600 p-3 max-w-xs">
        {soundBlocked && (
          <Button
            type="button"
            size="sm"
            className="w-full mb-2 bg-amber-500 hover:bg-amber-600 text-white font-medium"
            onClick={() => {
              notificationAudioRef.current?.play().then(() => setSoundBlocked(false)).catch(() => {})
            }}
          >
            <Volume2 className="w-4 h-4 mr-1.5 inline" />
            Click to enable sound
          </Button>
        )}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button onClick={toggleMute} variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-600 dark:text-slate-400" /> : <Volume2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
              title="Volume"
            />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-8 text-right shrink-0">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Centered modal — Material Design style */}
      <Dialog open={true}>
        <DialogContent
          showCloseButton={false}
          className="max-w-md w-[calc(100%-2rem)] rounded-3xl border-0 bg-white dark:bg-slate-900 shadow-2xl p-0 overflow-hidden"
          overlayClassName="z-[200]"
          contentClassName="z-[201] fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
                <Bell className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  Order alert
                </DialogTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  {totalAlerts} waiting for acknowledgment · Sound continues until all are acknowledged
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
            {newOrders.map((order) => (
              <div
                key={order._id}
                className="rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                      <UtensilsCrossed className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-lg">Order #{order.orderNumber}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">New order — tap to acknowledge</p>
                    </div>
                  </div>
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleAcknowledge(order._id) }}
                    size="lg"
                    className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Order Received
                  </Button>
                </div>
              </div>
            ))}

            {tableRequests.map((req) => (
              <div
                key={req._id}
                className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                      {req.customerRequestType === 'call_waiter' ? (
                        <HandHelping className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-lg">
                        Table {req.tableNumber || '—'} · #{req.orderNumber}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        {req.customerRequestType === 'call_waiter' ? (
                          <>Needs help</>
                        ) : (
                          <>Wants to pay ({req.customerRequestPaymentMethod === 'cash' ? 'Cash' : 'Card'})</>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleAcknowledgeTableRequest(req._id) }}
                    size="lg"
                    className="shrink-0 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-md"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Got it
                  </Button>
                </div>
              </div>
            ))}

            {standaloneTableRequests.map((req) => (
              <div
                key={req._id}
                className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                      <HandHelping className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-lg">
                        Table {req.tableNumber}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        Customer requested a waiter
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleAcknowledgeStandaloneTableRequest(req._id) }}
                    size="lg"
                    className="shrink-0 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-md"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Got it
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
