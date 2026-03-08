'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Check, Volume2, VolumeX, HandHelping, CreditCard, UtensilsCrossed, Truck, Store, MapPin, Phone, Navigation, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { googleMapsNavigationUrl, wazeNavigationUrl } from '@/lib/maps-utils'

interface NewOrder {
  _id: string
  orderNumber: string
  createdAt: string
  orderType?: 'delivery' | 'dine-in' | 'receive-in-person'
  customerName?: string
  customerPhone?: string
  tableNumber?: string
  deliveryAddress?: string
  deliveryArea?: { _id: string; name_en: string; name_ar: string }
  deliveryLat?: number
  deliveryLng?: number
  totalAmount?: number
  currency?: string
  scheduledFor?: string
  notifyAt?: string
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
  onAcknowledge: (orderId: string, statusOverride?: string, notifyAt?: string) => void
  onAcknowledgeTableRequest?: (orderId: string) => void
  onAcknowledgeStandaloneTableRequest?: (id: string) => void
  initialNewOrders?: NewOrder[]
  initialTableRequests?: TableRequest[]
  initialStandaloneTableRequests?: StandaloneTableRequest[]
  /** When provided (e.g. tenant page), use this sound so it works without fetching global restaurantInfo */
  initialNotificationSound?: string
  /** When true, only show volume control; do not show the blocking alert dialog (so order details modal can receive touches) */
  suppressDialog?: boolean
}

function NewOrderCard({ order, onAcknowledge }: { order: NewOrder, onAcknowledge: (orderId: string, statusOverride?: string, notifyAt?: string) => void }) {
  const [reminderMinutes, setReminderMinutes] = useState(60)

  const isDelivery = order.orderType === 'delivery'
  const isDineIn = order.orderType === 'dine-in'
  const isPickup = order.orderType === 'receive-in-person'
  const hasCoords = order.deliveryLat != null && order.deliveryLng != null && Number.isFinite(order.deliveryLat) && Number.isFinite(order.deliveryLng)
  const mapsUrl = hasCoords ? googleMapsNavigationUrl({ lat: order.deliveryLat!, lng: order.deliveryLng! }) : null
  const wazeUrl = hasCoords ? wazeNavigationUrl({ lat: order.deliveryLat!, lng: order.deliveryLng! }) : null
  const areaName = order.deliveryArea?.name_en || order.deliveryArea?.name_ar || null
  const isScheduled = !!order.scheduledFor

  // Per-type styles
  const cardStyle = isScheduled 
    ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40'
    : isDelivery
      ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40'
      : isDineIn
        ? 'border-fuchsia-300 dark:border-fuchsia-700 bg-fuchsia-50 dark:bg-fuchsia-950/40'
        : 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/40'
  const iconBg = isScheduled
    ? 'bg-purple-600'
    : isDelivery
      ? 'bg-blue-600'
      : isDineIn
        ? 'bg-fuchsia-600'
        : 'bg-teal-600'
  const badgeBg = isScheduled
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
    : isDelivery
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
      : isDineIn
        ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/60 dark:text-fuchsia-300'
        : 'bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300'
  const btnStyle = isScheduled
    ? 'bg-purple-600 hover:bg-purple-700 text-white'
    : isDelivery
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : isDineIn
        ? 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white'
        : 'bg-teal-600 hover:bg-teal-700 text-white'
  const Icon = isScheduled ? Clock : isDelivery ? Truck : isDineIn ? UtensilsCrossed : Store
  const typeLabel = isScheduled ? 'Scheduled' : isDelivery ? 'Delivery' : isDineIn ? 'Dine-in' : 'Pickup'

  const handleKeepInScheduled = (e: React.MouseEvent) => {
    e.stopPropagation()
    const targetDate = new Date(order.scheduledFor!)
    targetDate.setMinutes(targetDate.getMinutes() - reminderMinutes)
    onAcknowledge(order._id, 'acknowledged', targetDate.toISOString())
  }

  const handleStartPreparing = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAcknowledge(order._id, 'preparing')
  }

  return (
    <div className={`rounded-2xl border-2 p-4 shadow-sm ${cardStyle}`}>
      {isScheduled && (
        <div className="mb-4 bg-purple-600 text-white px-4 py-3 rounded-xl shadow-md text-sm font-bold flex items-center gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10 pointer-events-none">
            <Clock className="w-20 h-20" />
          </div>
          <Clock className="w-5 h-5 shrink-0 z-10" />
          <span className="z-10">
            Scheduled for: {new Date(order.scheduledFor!).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
      )}

      {/* Top row: icon + type badge + order number */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wide ${badgeBg}`}>
              <Icon className="h-3 w-3" />
              {typeLabel}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">#{order.orderNumber}</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">
            {order.customerName || 'Customer'}
          </p>
        </div>
      </div>

      {/* Details row */}
      <div className="space-y-1.5 mb-3 pl-14">
        {/* Delivery: area + address + map links */}
        {isDelivery && (
          <>
            {areaName && (
              <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                <span className="font-semibold">{areaName}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium line-clamp-2">
                {order.deliveryAddress}
              </p>
            )}
            {order.customerPhone && (
              <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <a href={`tel:${order.customerPhone}`} className="font-semibold hover:underline">{order.customerPhone}</a>
              </div>
            )}
            {hasCoords && (
              <div className="flex items-center gap-2 pt-0.5">
                <a
                  href={mapsUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700"
                >
                  <Navigation className="h-3 w-3" />
                  Maps
                </a>
                <a
                  href={wazeUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 text-white text-xs font-bold shadow-sm hover:bg-sky-600"
                >
                  <Navigation className="h-3 w-3" />
                  Waze
                </a>
              </div>
            )}
          </>
        )}

        {/* Dine-in: table number + phone */}
        {isDineIn && (
          <>
            {order.tableNumber && (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-fuchsia-600 text-white text-sm font-black shrink-0">
                  {order.tableNumber}
                </span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Table {order.tableNumber}</span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <a href={`tel:${order.customerPhone}`} className="font-semibold hover:underline">{order.customerPhone}</a>
              </div>
            )}
          </>
        )}

        {/* Pickup: phone */}
        {isPickup && order.customerPhone && (
          <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <a href={`tel:${order.customerPhone}`} className="font-semibold hover:underline">{order.customerPhone}</a>
          </div>
        )}

        {/* Total */}
        {order.totalAmount != null && (
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {order.totalAmount.toFixed(2)} {order.currency || ''}
          </p>
        )}
      </div>

      {isScheduled ? (
        <div className="space-y-3 mt-4 pt-4 border-t border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-purple-900 dark:text-purple-100 flex-1">
              Remind me in:
            </label>
            <select
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-white dark:bg-purple-950 text-sm font-bold text-purple-700 dark:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleKeepInScheduled}
              className="w-full rounded-xl font-black text-sm h-11 bg-purple-600 hover:bg-purple-700 text-white"
            >
              Keep in Scheduled Orders
            </Button>
            <Button
              onClick={handleStartPreparing}
              variant="outline"
              className="w-full rounded-xl font-black text-sm h-11 border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              Start Preparing Now
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={(e) => { e.stopPropagation(); onAcknowledge(order._id) }}
          className={`w-full rounded-xl font-black text-base h-11 shadow-md mt-2 ${btnStyle}`}
        >
          <Check className="w-4 h-4 mr-2" />
          {isDelivery ? 'Accept Delivery' : isDineIn ? 'Order Received' : 'Order Received'}
        </Button>
      )}
    </div>
  )
}

export function OrderNotifications({
  onAcknowledge,
  onAcknowledgeTableRequest,
  onAcknowledgeStandaloneTableRequest,
  initialNewOrders = [],
  initialTableRequests = [],
  initialStandaloneTableRequests = [],
  initialNotificationSound: initialSound,
  suppressDialog = false,
}: OrderNotificationsProps) {
  const [newOrders, setNewOrders] = useState<NewOrder[]>(initialNewOrders)
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

  const handleAcknowledge = async (orderId: string, statusOverride?: string, notifyAt?: string) => {
    try {
      isAcknowledgingRef.current = orderId
      setNewOrders((prev) => prev.filter((o) => o._id !== orderId))
      await onAcknowledge(orderId, statusOverride, notifyAt)
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

  if (suppressDialog) {
    return (
      <div className="fixed bottom-4 right-4 z-[350] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-600 p-3 max-w-xs">
        {soundBlocked && (
          <Button type="button" size="sm" className="w-full mb-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium" onClick={() => { notificationAudioRef.current?.play().then(() => setSoundBlocked(false)).catch(() => {}) }}>
            <Volume2 className="w-4 h-4 mr-1.5 inline" />
            Click to enable sound
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Button onClick={toggleMute} variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-600 dark:text-slate-400" /> : <Volume2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
          </Button>
          <input type="range" min="0" max="1" step="0.1" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="flex-1 h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-orange-500" title="Volume" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-8 text-right shrink-0">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Volume controls — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-600 p-3 max-w-xs">
        {soundBlocked && (
          <Button
            type="button"
            size="sm"
            className="w-full mb-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium"
            onClick={() => {
              notificationAudioRef.current?.play().then(() => setSoundBlocked(false)).catch(() => {})
            }}
          >
            <Volume2 className="w-4 h-4 mr-1.5 inline" />
            Click to enable sound
          </Button>
        )}
        <div className="flex items-center gap-2">
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

      {/* Centered modal */}
      <Dialog open={true}>
        <DialogContent
          showCloseButton={false}
          className="max-w-lg w-[calc(100%-2rem)] rounded-3xl border-0 bg-white dark:bg-slate-900 shadow-2xl p-0 overflow-hidden"
          overlayClassName="z-[200]"
          contentClassName="z-[201] fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/40">
                  <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
                  {totalAlerts > 1 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">
                      {totalAlerts}
                    </span>
                  )}
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-slate-900 dark:text-white leading-tight">
                    {totalAlerts === 1 ? 'New Alert' : `${totalAlerts} Alerts`}
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Acknowledge all to stop the sound
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">

            {/* New Orders */}
            {newOrders.map((order) => (
              <NewOrderCard key={order._id} order={order} onAcknowledge={handleAcknowledge} />
            ))}

            {/* Table Requests (dine-in order: waiter or check) */}
            {tableRequests.map((req) => {
              const isWaiter = req.customerRequestType === 'call_waiter'
              const cardStyle = isWaiter
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40'
                : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40'
              const iconBg = isWaiter ? 'bg-amber-500' : 'bg-emerald-600'
              const badgeBg = isWaiter
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
              const btnStyle = isWaiter
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              const Icon = isWaiter ? HandHelping : CreditCard
              const typeLabel = isWaiter ? 'Waiter Help' : 'Pay Request'

              return (
                <div
                  key={req._id}
                  className={`rounded-2xl border-2 p-4 shadow-sm ${cardStyle}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wide ${badgeBg}`}>
                          <Icon className="h-3 w-3" />
                          {typeLabel}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">#{req.orderNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-base font-black shrink-0">
                          {req.tableNumber || '?'}
                        </span>
                        <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                          Table {req.tableNumber || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="pl-14 mb-3">
                    {!isWaiter && req.customerRequestPaymentMethod && (
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Payment method: <span className="font-black">{req.customerRequestPaymentMethod === 'cash' ? 'Cash' : 'Card'}</span>
                      </p>
                    )}
                    {isWaiter && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">Customer needs assistance at the table.</p>
                    )}
                  </div>
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleAcknowledgeTableRequest(req._id) }}
                    className={`w-full rounded-xl font-black text-base h-11 shadow-md ${btnStyle}`}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {isWaiter ? `Go to Table ${req.tableNumber || ''}` : 'On My Way'}
                  </Button>
                </div>
              )
            })}

            {/* Standalone Waiter Requests (no order) */}
            {standaloneTableRequests.map((req) => (
              <div
                key={req._id}
                className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500">
                    <HandHelping className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                        <HandHelping className="h-3 w-3" />
                        Waiter Call
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-base font-black shrink-0">
                        {req.tableNumber}
                      </span>
                      <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                        Table {req.tableNumber}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pl-14 mb-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Customer needs a waiter at this table.</p>
                </div>
                <Button
                  onClick={(e) => { e.stopPropagation(); handleAcknowledgeStandaloneTableRequest(req._id) }}
                  className="w-full rounded-xl font-black text-base h-11 shadow-md bg-amber-500 hover:bg-amber-600 text-slate-950"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Go to Table {req.tableNumber}
                </Button>
              </div>
            ))}

          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
