'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Minimize2, Navigation, Loader2, X, Locate, RotateCw, Timer, Banknote, Heart, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/components/LanguageContext'
import { formatCurrency } from '@/lib/currency'
import { distanceKm } from '@/lib/maps-utils'

if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

/* ─── Icons ─────────────────────────────────────────────────────────── */

const DRIVER_ICON_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`

const driverIcon = typeof window !== 'undefined' ? L.divIcon({
  html: `<div style="width:48px;height:48px;background:#2563eb;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">${DRIVER_ICON_SVG}</div>`,
  className: '',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
}) : null

function makeDestIcon(label?: string, logoUrl?: string) {
  if (typeof window === 'undefined') return null

  const hasLogo = logoUrl && logoUrl.length > 0
  const displayLabel = label || ''
  const truncatedLabel = displayLabel.length > 22 ? displayLabel.slice(0, 20) + '…' : displayLabel

  const logoHtml = hasLogo
    ? `<img src="${logoUrl}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;border:1px solid rgba(255,255,255,0.3);flex-shrink:0;" onerror="this.style.display='none'" />`
    : ''

  const labelBadge = truncatedLabel
    ? `<div style="
        position:absolute;
        bottom:calc(100% + 6px);
        left:50%;
        transform:translateX(-50%);
        background:rgba(15,23,42,0.92);
        backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,0.15);
        border-radius:10px;
        padding:5px 10px;
        display:flex;
        align-items:center;
        gap:6px;
        white-space:nowrap;
        max-width:200px;
        box-shadow:0 2px 12px rgba(0,0,0,0.4);
      ">${logoHtml}<span style="font-size:11px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;">${truncatedLabel}</span></div>`
    : ''

  return L.divIcon({
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      ${labelBadge}
      <div style="width:40px;height:40px;background:#dc2626;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      </div>
    </div>`,
    className: '',
    iconSize: [40, 60],
    iconAnchor: [20, 60],
  })
}

/* ─── Formatters ────────────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  if (seconds < 60) return `<1 min`
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hrs}h ${remainMins}m`
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/* ─── Map Updater ───────────────────────────────────────────────────── */

/**
 * Navigation-style map updater.
 * In follow mode the driver is kept at the vertical centre of the usable
 * viewport (between top bar and bottom bar) so the road ahead and behind
 * are equally visible — matching what drivers expect from Waze / Google Maps.
 *
 * Also calls invalidateSize() on mount so the Leaflet container recalculates
 * its dimensions after being remounted (prevents the "stuck / blank map" bug
 * when transitioning from hidden → maximized).
 */
function MapUpdater({
  driverLat,
  driverLng,
  destLat,
  destLng,
  followDriver,
  onUserInteraction,
  topBarPx,
  bottomBarPx,
}: {
  driverLat: number
  driverLng: number
  destLat: number
  destLng: number
  route: [number, number][]
  followDriver: boolean
  onUserInteraction: () => void
  topBarPx: number
  bottomBarPx: number
}) {
  const map = useMap()
  const hasSetInitialView = useRef(false)

  // Force Leaflet to recalculate container size after mount / remount.
  // Without this, tiles may not load when the component is dynamically
  // toggled (hidden → maximized).
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(timer)
  }, [map])

  useEffect(() => {
    const onDragStart = () => onUserInteraction()
    map.on('dragstart', onDragStart)
    return () => { map.off('dragstart', onDragStart) }
  }, [map, onUserInteraction])

  useEffect(() => {
    if (!driverLat || !driverLng) return

    if (followDriver) {
      let zoom = 16
      if (destLat && destLng) {
        const dist = distanceKm({ lat: driverLat, lng: driverLng }, { lat: destLat, lng: destLng })
        if (dist > 10) zoom = 12
        else if (dist > 5) zoom = 13
        else if (dist > 2) zoom = 14
        else if (dist > 1) zoom = 15
        else if (dist > 0.3) zoom = 16
        else zoom = 17
      }

      const mapSize = map.getSize()
      if (mapSize.y === 0) {
        map.invalidateSize()
        return
      }

      const usableHeight = mapSize.y - topBarPx - bottomBarPx
      const targetPoint = map.project([driverLat, driverLng], zoom)
      // Place the driver at the vertical centre of the usable area so
      // equal road is visible ahead and behind.
      const driverYInUsable = usableHeight * 0.5
      const driverScreenY = topBarPx + driverYInUsable
      const centerScreenY = mapSize.y / 2
      const offsetPixels = driverScreenY - centerScreenY
      const offsetPoint = L.point(targetPoint.x, targetPoint.y + offsetPixels)
      const offsetLatLng = map.unproject(offsetPoint, zoom)

      if (!hasSetInitialView.current) {
        map.setView(offsetLatLng, zoom, { animate: false })
        hasSetInitialView.current = true
      } else {
        map.setView(offsetLatLng, zoom, { animate: true, duration: 1 })
      }
    } else if (!hasSetInitialView.current) {
      if (destLat && destLng) {
        const bounds = L.latLngBounds([driverLat, driverLng], [destLat, destLng])
        map.fitBounds(bounds, { padding: [80, 80] })
      } else {
        map.setView([driverLat, driverLng], 15)
      }
      hasSetInitialView.current = true
    }
  }, [driverLat, driverLng, destLat, destLng, map, followDriver, topBarPx, bottomBarPx])

  return null
}

/* ─── Component ─────────────────────────────────────────────────────── */

interface DriverNavigationMapProps {
  driverLat: number | null
  driverLng: number | null
  destLat: number | null
  destLng: number | null
  onMinimize: () => void
  onClose: () => void
  destinationLabel?: string
  destinationLogoUrl?: string
  /** Delivery countdown info (Phase C only) */
  countdown?: {
    driverPickedUpAt: string
    estimatedDeliveryMinutes: number
  }
  /** Order financial info for the floating bar */
  orderInfo?: {
    totalAmount: number
    currency: string
    tipAmount?: number
    tipSentToDriver?: boolean
    tipIncludedInTotal?: boolean
    driverArrivedAt?: string
  }
  /** Called when the driver slides "I Arrived" from within the map */
  onArrive?: (orderId: string) => void
  /** The order ID (needed for the arrive action) */
  orderId?: string
}

const TOP_BAR_HEIGHT = 88
const BOTTOM_BAR_HEIGHT = 80

export default function DriverNavigationMap({
  driverLat,
  driverLng,
  destLat,
  destLng,
  onMinimize,
  onClose,
  destinationLabel,
  destinationLogoUrl,
  countdown,
  orderInfo,
  onArrive,
  orderId,
}: DriverNavigationMapProps) {
  const { t } = useLanguage()
  const [route, setRoute] = useState<[number, number][]>([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const [routeDistance, setRouteDistance] = useState<number | null>(null)
  const [routeDuration, setRouteDuration] = useState<number | null>(null)
  const [followDriver, setFollowDriver] = useState(true)

  const [countdownNow, setCountdownNow] = useState(() => Date.now())
  const [arriveSliderX, setArriveSliderX] = useState(0)
  const [arriveSliding, setArriveSliding] = useState(false)
  const arriveTrackRef = useRef<HTMLDivElement>(null)

  // Countdown ticker
  useEffect(() => {
    if (!countdown) return
    const id = setInterval(() => setCountdownNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [!!countdown])

  const countdownData = useMemo(() => {
    if (!countdown) return null
    const pickedMs = new Date(countdown.driverPickedUpAt).getTime()
    const targetMs = pickedMs + countdown.estimatedDeliveryMinutes * 60 * 1000
    const remainMs = targetMs - countdownNow
    if (remainMs <= 0) return { minutes: 0, seconds: 0, overdue: true }
    return {
      minutes: Math.floor(remainMs / 60000),
      seconds: Math.floor((remainMs % 60000) / 1000),
      overdue: false,
    }
  }, [countdown, countdownNow])

  // Proximity check for arrival modal
  const distToDestKm = useMemo(() => {
    if (!driverLat || !driverLng || !destLat || !destLng) return null
    return distanceKm({ lat: driverLat, lng: driverLng }, { lat: destLat, lng: destLng })
  }, [driverLat, driverLng, destLat, destLng])

  const isWithin100m = distToDestKm != null && distToDestKm <= 0.1
  const showArriveModal = isWithin100m && onArrive && orderId && !orderInfo?.driverArrivedAt

  const handleArriveSlideComplete = useCallback(() => {
    if (onArrive && orderId) {
      onArrive(orderId)
    }
    setArriveSliderX(0)
    setArriveSliding(false)
  }, [onArrive, orderId])

  const handleRecenter = useCallback(() => {
    setFollowDriver(true)
  }, [])

  const handleUserInteraction = useCallback(() => {
    setFollowDriver(false)
  }, [])

  const destIcon = useMemo(
    () => makeDestIcon(destinationLabel, destinationLogoUrl),
    [destinationLabel, destinationLogoUrl],
  )

  // Fetch route from OSRM
  useEffect(() => {
    if (!driverLat || !driverLng || !destLat || !destLng) {
      setRoute([])
      setRouteDistance(null)
      setRouteDuration(null)
      return
    }

    let cancelled = false

    const fetchRoute = async () => {
      setRouteLoading(true)
      setRouteError(false)
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${destLng},${destLat}?overview=full&geometries=geojson`
        const res = await fetch(url)
        const data = await res.json()

        if (cancelled) return

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const r = data.routes[0]
          const coords = r.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]] as [number, number],
          )
          setRoute(coords)
          setRouteDistance(r.distance ?? null)
          setRouteDuration(r.duration ?? null)
        } else {
          setRouteError(true)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching route:', err)
          setRouteError(true)
        }
      } finally {
        if (!cancelled) setRouteLoading(false)
      }
    }

    fetchRoute()
    const interval = setInterval(fetchRoute, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [driverLat, driverLng, destLat, destLng])

  const straightLineKm =
    driverLat && driverLng && destLat && destLng
      ? distanceKm(
          { lat: driverLat, lng: driverLng },
          { lat: destLat, lng: destLng },
        )
      : null

  /* ── Loading state ─────────────────────────────────── */
  if (!driverLat || !driverLng) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center text-white"
        style={{
          paddingTop:
            'max(16px, calc(env(safe-area-inset-top, 0px) + 12px))',
        }}
      >
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-emerald-500" />
        <p className="font-bold text-lg">
          {t('Locating driver...', 'جاري تحديد موقع السائق...')}
        </p>
        <button
          onClick={onMinimize}
          className="mt-6 text-slate-400 hover:text-white font-semibold text-base px-6 py-3 rounded-2xl transition-colors"
        >
          {t('Close', 'إغلاق')}
        </button>
      </div>
    )
  }

  const center: [number, number] = [driverLat, driverLng]

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col">
      {/* ── Top Bar ────────────────────────────────────── */}
      <div
        className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 px-4 flex items-center justify-between absolute top-0 left-0 right-0 z-[9999] shadow-lg"
        style={{
          paddingTop:
            'max(14px, calc(env(safe-area-inset-top, 0px) + 10px))',
          paddingBottom: '14px',
        }}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Destination icon — bigger */}
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
            <Navigation className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-white leading-tight text-base truncate">
              {destinationLabel || t('Navigation', 'التنقل')}
            </h2>
            <div className="flex items-center gap-2.5 mt-1">
              {routeDistance != null && routeDuration != null ? (
                <>
                  <span className="text-emerald-400 text-sm font-bold">
                    {formatDistance(routeDistance)}
                  </span>
                  <span className="text-slate-600 text-sm">·</span>
                  <span className="text-sky-400 text-sm font-bold">
                    {formatDuration(routeDuration)}
                  </span>
                </>
              ) : straightLineKm != null ? (
                <span className="text-slate-400 text-sm font-medium">
                  {straightLineKm.toFixed(1)} km {t('away', 'بعيد')}
                </span>
              ) : null}
              {routeLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 ml-1" />
              )}
            </div>
          </div>
        </div>

        {/* Action buttons — bigger touch targets */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onMinimize}
            className="w-11 h-11 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white active:scale-95 transition-all"
            title={t('Minimize', 'تصغير')}
          >
            <Minimize2 className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white active:scale-95 transition-all"
            title={t('Close', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────── */}
      <div className="flex-1 relative w-full h-full">
        <MapContainer
          center={center}
          zoom={16}
          zoomControl={false}
          className="w-full h-full"
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />

          <MapUpdater
            driverLat={driverLat}
            driverLng={driverLng}
            destLat={destLat!}
            destLng={destLng!}
            route={route}
            followDriver={followDriver}
            onUserInteraction={handleUserInteraction}
            topBarPx={TOP_BAR_HEIGHT}
            bottomBarPx={BOTTOM_BAR_HEIGHT}
          />

          {/* Driver Marker */}
          {driverIcon && (
            <Marker
              position={[driverLat, driverLng]}
              icon={driverIcon}
              zIndexOffset={200}
            />
          )}

          {/* Destination Marker (with label badge) */}
          {destLat && destLng && destIcon && (
            <Marker
              position={[destLat, destLng]}
              icon={destIcon}
              zIndexOffset={100}
            />
          )}

          {/* Route Polyline */}
          {route.length > 0 && (
            <>
              <Polyline
                positions={route}
                color="#1e293b"
                weight={10}
                opacity={0.25}
              />
              <Polyline
                positions={route}
                color="#3b82f6"
                weight={6}
                opacity={1}
              />
            </>
          )}
        </MapContainer>

        {/* Re-center button */}
        {!followDriver && (
          <button
            onClick={handleRecenter}
            className="absolute bottom-28 right-4 z-[500] w-14 h-14 bg-white rounded-full shadow-xl border border-slate-200 flex items-center justify-center text-blue-600 active:scale-95 transition-transform"
            title={t('Re-center on driver', 'إعادة التمركز على السائق')}
          >
            <Locate className="w-7 h-7" />
          </button>
        )}
      </div>

      {/* ── Floating Order Info Bar (countdown + total + tip) ─── */}
      {orderInfo && countdownData && !countdownData.overdue && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute left-3 right-3 z-[9998]"
          style={{ top: `${TOP_BAR_HEIGHT + 8}px` }}
        >
          <div className="bg-slate-900/90 backdrop-blur-lg rounded-2xl border border-slate-700/50 shadow-2xl px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Countdown */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Timer className="w-4.5 h-4.5 text-purple-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">
                    {t('DELIVER BY', 'وصّل قبل')}
                  </p>
                  <p className="text-xl font-black text-white tabular-nums leading-tight mt-0.5">
                    {String(countdownData.minutes).padStart(2, '0')}
                    <span className="text-purple-400/60">:</span>
                    {String(countdownData.seconds).padStart(2, '0')}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-slate-700/60 shrink-0" />

              {/* Total */}
              <div className="text-center min-w-0">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">
                  {t('TOTAL', 'المجموع')}
                </p>
                <p className="text-lg font-black text-emerald-400 tabular-nums leading-tight mt-0.5">
                  {(() => {
                    const total = orderInfo.tipIncludedInTotal
                      ? orderInfo.totalAmount + (orderInfo.tipAmount ?? 0)
                      : orderInfo.totalAmount
                    return total.toFixed(2)
                  })()}
                </p>
                <p className="text-[9px] text-slate-500 font-medium leading-none">
                  {formatCurrency(orderInfo.currency)}
                </p>
              </div>

              {/* Tip badge (only when sent to driver) */}
              <AnimatePresence>
                {orderInfo.tipSentToDriver && (orderInfo.tipAmount ?? 0) > 0 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="shrink-0"
                  >
                    <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl px-2.5 py-1.5 text-center">
                      <div className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-400" />
                        <p className="text-[9px] text-rose-400/80 font-bold uppercase leading-none">
                          {t('TIP', 'إكرامية')}
                        </p>
                      </div>
                      <p className="text-sm font-black text-rose-400 tabular-nums leading-tight mt-0.5">
                        +{(orderInfo.tipAmount ?? 0).toFixed(0)}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Overdue banner ───────────────────────────── */}
      {orderInfo && countdownData?.overdue && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute left-3 right-3 z-[9998]"
          style={{ top: `${TOP_BAR_HEIGHT + 8}px` }}
        >
          <div className="bg-amber-500/90 backdrop-blur-lg rounded-2xl shadow-2xl px-4 py-3 text-center">
            <p className="text-sm font-black text-white">
              {t('Time is up — deliver ASAP!', 'انتهى الوقت — وصّل بأسرع وقت!')}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── I Arrived Slider Modal (within 100m) ─────── */}
      <AnimatePresence>
        {showArriveModal && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="absolute left-3 right-3 z-[9999]"
            style={{ bottom: `calc(${BOTTOM_BAR_HEIGHT + 16}px + max(0px, env(safe-area-inset-bottom, 0px)))` }}
          >
            <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-blue-500/30 shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <MapPin className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <p className="text-white font-black text-sm">
                    {t('You\'re at the customer\'s location!', 'أنت عند موقع العميل!')}
                  </p>
                  <p className="text-blue-200/80 text-xs font-medium">
                    {distToDestKm != null ? `${Math.round(distToDestKm * 1000)}m ${t('away', 'بعيد')}` : ''}
                  </p>
                </div>
              </div>

              <div className="px-5 py-4">
                {/* Slide to arrive track */}
                <div
                  ref={arriveTrackRef}
                  className="relative h-16 rounded-2xl bg-blue-950/60 border border-blue-500/20 overflow-hidden"
                  onTouchStart={(e) => {
                    const touch = e.touches[0]
                    const rect = arriveTrackRef.current?.getBoundingClientRect()
                    if (!rect) return
                    if (touch.clientX - rect.left < 70) {
                      setArriveSliding(true)
                      setArriveSliderX(0)
                    }
                  }}
                  onTouchMove={(e) => {
                    if (!arriveSliding || !arriveTrackRef.current) return
                    const rect = arriveTrackRef.current.getBoundingClientRect()
                    const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left - 28, rect.width - 56))
                    setArriveSliderX(x)
                  }}
                  onTouchEnd={() => {
                    if (!arriveSliding || !arriveTrackRef.current) return
                    const rect = arriveTrackRef.current.getBoundingClientRect()
                    const threshold = rect.width - 80
                    if (arriveSliderX >= threshold) {
                      handleArriveSlideComplete()
                    } else {
                      setArriveSliderX(0)
                    }
                    setArriveSliding(false)
                  }}
                >
                  {/* Shimmer hint */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <motion.div
                      animate={{ x: [0, 30, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                      className="text-blue-400/30 font-bold text-sm"
                    >
                      {t('Slide to confirm arrival →', 'اسحب لتأكيد الوصول ←')}
                    </motion.div>
                  </div>

                  {/* Slider thumb */}
                  <motion.div
                    className="absolute top-2 left-2 w-12 h-12 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 shadow-lg flex items-center justify-center z-10"
                    style={{ x: arriveSliderX }}
                    animate={!arriveSliding ? { x: 0 } : undefined}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    <MapPin className="w-6 h-6 text-white" />
                  </motion.div>

                  {/* Progress fill */}
                  <motion.div
                    className="absolute top-0 left-0 bottom-0 bg-blue-500/10 rounded-2xl"
                    style={{ width: arriveSliderX + 56 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom Card — ETA & Distance ────────────── */}
      {(routeDistance != null || straightLineKm != null) && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[9998] bg-slate-900/95 backdrop-blur-md border-t border-slate-700/60"
          style={{
            paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 flex-1 min-w-0">
              {routeDuration != null && (
                <div className="text-center">
                  <p className="text-3xl font-black text-white leading-none tabular-nums">
                    {routeDuration < 60
                      ? '<1'
                      : Math.round(routeDuration / 60)}
                  </p>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    {t('MIN', 'دقيقة')}
                  </p>
                </div>
              )}
              {routeDistance != null && (
                <div className="text-center">
                  <p className="text-3xl font-black text-emerald-400 leading-none tabular-nums">
                    {formatDistance(routeDistance)}
                  </p>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    {t('DISTANCE', 'المسافة')}
                  </p>
                </div>
              )}
              {routeError && !routeLoading && (
                <p className="text-sm font-bold text-amber-400">
                  {t('Route unavailable', 'المسار غير متاح')}
                </p>
              )}
            </div>
            {routeLoading && (
              <div className="shrink-0">
                <RotateCw className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
