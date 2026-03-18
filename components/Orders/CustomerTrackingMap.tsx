'use client'

/**
 * CustomerTrackingMap
 * -------------------
 * Customer-facing live delivery map.
 * Shows three pins (restaurant → driver → customer) connected by an OSRM route.
 * The driver marker updates in real-time via Pusher without any Sanity round-trip.
 *
 * Design: Material Design 3 — surface/container tokens, 8dp grid, M3 easing.
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Maximize2,
  Minimize2,
  Navigation2,
  MapPin,
  Store,
  Home,
  Locate,
  RotateCw,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { distanceKm } from '@/lib/maps-utils'

/* ─── Fix Leaflet default icon paths in Next.js ───────────────────────── */
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

/* ─── M3 colour tokens (match the app's emerald / amber palette) ──────── */
const M3 = {
  primary: '#16a34a',         // emerald-600
  primaryContainer: '#dcfce7', // emerald-100
  onPrimary: '#ffffff',
  secondary: '#d97706',        // amber-600 — driver accent
  secondaryContainer: '#fef3c7',
  surface: '#ffffff',
  surfaceVariant: '#f0fdf4',   // emerald-50
  onSurface: '#0f172a',        // slate-900
  onSurfaceVariant: '#475569', // slate-600
  outline: '#e2e8f0',          // slate-200
  scrim: 'rgba(15,23,42,0.55)',
}

/* ─── Custom DivIcons ─────────────────────────────────────────────────── */

/** Animated driver marker — amber circle with navigation arrow + live pulse ring */
function makeDriverIcon(isLive: boolean) {
  if (typeof window === 'undefined') return null
  const pulse = isLive
    ? `<span style="
        position:absolute;inset:-8px;border-radius:50%;
        border:2.5px solid ${M3.secondary};
        animation:ctm-pulse 2s ease-out infinite;
        pointer-events:none;
      "></span>`
    : ''
  return L.divIcon({
    html: `
      <style>
        @keyframes ctm-pulse{0%{transform:scale(1);opacity:0.8}100%{transform:scale(1.9);opacity:0}}
      </style>
      <div style="position:relative;width:48px;height:48px;">
        ${pulse}
        <div style="
          width:48px;height:48px;border-radius:50%;
          background:${M3.secondary};
          border:3px solid ${M3.surface};
          box-shadow:0 4px 16px rgba(217,119,6,0.45);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </div>
      </div>`,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  })
}

/** Restaurant pin — brand red circle with store icon */
const restaurantIcon = typeof window !== 'undefined' ? L.divIcon({
  html: `<div style="
      position:relative;display:flex;flex-direction:column;align-items:center;
    ">
      <div style="
        width:44px;height:44px;border-radius:50%;
        background:#dc2626;border:3px solid ${M3.surface};
        box-shadow:0 4px 12px rgba(220,38,38,0.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div style="width:3px;height:12px;background:#dc2626;border-radius:0 0 2px 2px;margin-top:-1px;"></div>
    </div>`,
  className: '',
  iconSize: [44, 58],
  iconAnchor: [22, 58],
}) : null

/** Customer / delivery destination pin — emerald circle with home icon */
const customerIcon = typeof window !== 'undefined' ? L.divIcon({
  html: `<div style="
      position:relative;display:flex;flex-direction:column;align-items:center;
    ">
      <div style="
        width:44px;height:44px;border-radius:50%;
        background:${M3.primary};border:3px solid ${M3.surface};
        box-shadow:0 4px 12px rgba(22,163,74,0.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div style="width:3px;height:12px;background:${M3.primary};border-radius:0 0 2px 2px;margin-top:-1px;"></div>
    </div>`,
  className: '',
  iconSize: [44, 58],
  iconAnchor: [22, 58],
}) : null

/* ─── SmoothDriverMarker ──────────────────────────────────────────────── */

/**
 * Renders the driver's Leaflet marker and animates it smoothly between GPS
 * pings using requestAnimationFrame + direct setLatLng calls.
 *
 * Why not React state?  Calling setState 60 times/second for 2 seconds would
 * trigger 120 re-renders of the entire MapContainer (tiles, polylines, other
 * markers).  Direct Leaflet manipulation is zero-cost and imperceptible to
 * React's diffing.  The ref is typed as L.Marker via react-leaflet's forwardRef.
 */
const GLIDE_MS = 2000

function SmoothDriverMarker({ lat, lng, icon }: { lat: number; lng: number; icon: L.DivIcon | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  const animRef = useRef<number | null>(null)
  // Track the displayed position so each new GPS ping starts from the right spot
  const displayPos = useRef<[number, number]>([lat, lng])

  useEffect(() => {
    const toLat = lat
    const toLng = lng
    const [fromLat, fromLng] = displayPos.current

    // Cancel any in-progress glide
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }

    const startTime = performance.now()

    const step = (now: number) => {
      const t = Math.min((now - startTime) / GLIDE_MS, 1)
      const curLat = fromLat + (toLat - fromLat) * t
      const curLng = fromLng + (toLng - fromLng) * t

      // Update Leaflet DOM directly — no React re-render
      markerRef.current?.setLatLng([curLat, curLng])
      displayPos.current = [curLat, curLng]

      if (t < 1) {
        animRef.current = requestAnimationFrame(step)
      } else {
        animRef.current = null
      }
    }

    animRef.current = requestAnimationFrame(step)

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current)
        animRef.current = null
      }
    }
  }, [lat, lng])

  if (!icon) return null
  return (
    <Marker
      ref={markerRef}
      position={[displayPos.current[0], displayPos.current[1]]}
      icon={icon}
      zIndexOffset={300}
    />
  )
}

/* ─── MapBoundsUpdater ────────────────────────────────────────────────── */

function MapBoundsUpdater({
  driverLat,
  driverLng,
  destLat,
  destLng,
  restaurantLat,
  restaurantLng,
  isExpanded,
}: {
  driverLat: number | null
  driverLng: number | null
  destLat: number | null
  destLng: number | null
  restaurantLat: number | null
  restaurantLng: number | null
  isExpanded: boolean
}) {
  const map = useMap()
  const prevDriver = useRef<{ lat: number; lng: number } | null>(null)
  const hasInitialised = useRef(false)

  // Invalidate size when expansion state changes (prevents blank tile bug)
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120)
    return () => clearTimeout(t)
  }, [isExpanded, map])

  // Follow driver in expanded mode; fit all pins on initial render or expansion
  useEffect(() => {
    if (!driverLat || !driverLng) return

    const driverChanged =
      !prevDriver.current ||
      Math.abs(prevDriver.current.lat - driverLat) > 0.00005 ||
      Math.abs(prevDriver.current.lng - driverLng) > 0.00005
    prevDriver.current = { lat: driverLat, lng: driverLng }

    if (!hasInitialised.current || !isExpanded) {
      // Fit all available pins into view
      const points: [number, number][] = [[driverLat, driverLng]]
      if (destLat && destLng) points.push([destLat, destLng])
      if (restaurantLat && restaurantLng) points.push([restaurantLat, restaurantLng])

      if (points.length === 1) {
        map.setView([driverLat, driverLng], 15, { animate: false })
      } else {
        const bounds = L.latLngBounds(points)
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16, animate: !hasInitialised.current ? false : true })
      }
      hasInitialised.current = true
    } else if (driverChanged && isExpanded) {
      // Smoothly pan to keep the driver centred
      map.panTo([driverLat, driverLng], { animate: true, duration: 1.2, easeLinearity: 0.25 })
    }
  }, [driverLat, driverLng, destLat, destLng, restaurantLat, restaurantLng, isExpanded, map])

  return null
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 1) return '<1 min'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function formatDist(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}

/* ─── Main Component ──────────────────────────────────────────────────── */

export interface CustomerTrackingMapProps {
  orderId: string
  /** Live driver position — updated by Pusher in parent */
  driverLat: number | null
  driverLng: number | null
  /** Customer's shared delivery GPS */
  deliveryLat: number | null
  deliveryLng: number | null
  /** Restaurant / business GPS */
  restaurantLat: number | null
  restaurantLng: number | null
  /** Driver display name */
  driverName?: string
  /** Restaurant display name */
  restaurantName?: string
  /** 'driver_on_the_way' = driver heading to restaurant; 'out-for-delivery' = heading to customer */
  orderStatus: 'driver_on_the_way' | 'out-for-delivery'
  /** Whether the Pusher subscription is confirmed live */
  isLive: boolean
  lang?: 'en' | 'ar'
}

export default function CustomerTrackingMap({
  driverLat,
  driverLng,
  deliveryLat,
  deliveryLng,
  restaurantLat,
  restaurantLng,
  driverName,
  restaurantName,
  orderStatus,
  isLive,
  lang = 'en',
}: CustomerTrackingMapProps) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const [isExpanded, setIsExpanded] = useState(false)
  const [route, setRoute] = useState<[number, number][]>([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeDistance, setRouteDistance] = useState<number | null>(null)
  const [routeDuration, setRouteDuration] = useState<number | null>(null)

  // Which destination is the driver heading to?
  const destLat = orderStatus === 'out-for-delivery' ? deliveryLat : restaurantLat
  const destLng = orderStatus === 'out-for-delivery' ? deliveryLng : restaurantLng

  // Memoised driver icon so it doesn't recreate on every GPS tick
  const driverIcon = useMemo(() => makeDriverIcon(isLive), [isLive])

  // Straight-line fallback distance
  const straightLineKm = useMemo(() => {
    if (!driverLat || !driverLng || !destLat || !destLng) return null
    return distanceKm({ lat: driverLat, lng: driverLng }, { lat: destLat, lng: destLng })
  }, [driverLat, driverLng, destLat, destLng])

  // OSRM route — re-fetch when driver moves meaningfully or destination changes
  const routeKey = useMemo(() => {
    if (!driverLat || !driverLng || !destLat || !destLng) return null
    // Snap to ~150m grid so minor wiggles don't hammer OSRM
    const snap = (v: number) => Math.round(v * 700) / 700
    return `${snap(driverLat)},${snap(driverLng)}_${snap(destLat)},${snap(destLng)}`
  }, [driverLat, driverLng, destLat, destLng])

  const fetchRoute = useCallback(async () => {
    if (!driverLat || !driverLng || !destLat || !destLng) return
    setRouteLoading(true)
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${destLng},${destLat}?overview=full&geometries=geojson`
      const res = await fetch(url)
      const data = await res.json()
      if (data.code === 'Ok' && data.routes?.[0]) {
        const r = data.routes[0]
        setRoute(r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]))
        setRouteDistance(r.distance ?? null)
        setRouteDuration(r.duration ?? null)
      }
    } catch {
      // silent — straight-line fallback is shown
    } finally {
      setRouteLoading(false)
    }
  }, [driverLat, driverLng, destLat, destLng])

  useEffect(() => {
    if (!routeKey) return
    fetchRoute()
  }, [routeKey, fetchRoute])

  // Lock body scroll when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isExpanded])

  const hasDriver = driverLat != null && driverLng != null
  const center: [number, number] = hasDriver
    ? [driverLat!, driverLng!]
    : destLat && destLng
      ? [destLat, destLng]
      : [0, 0]

  /* Legend pills */
  const pills = [
    { icon: <Store className="h-3 w-3" />, label: restaurantName || t('Restaurant', 'المطعم'), color: '#dc2626' },
    { icon: <Navigation2 className="h-3 w-3" />, label: driverName || t('Driver', 'السائق'), color: M3.secondary },
    ...(deliveryLat && deliveryLng
      ? [{ icon: <Home className="h-3 w-3" />, label: t('You', 'أنت'), color: M3.primary }]
      : []),
  ]

  const mapContent = (
    <MapContainer
      center={center}
      zoom={14}
      zoomControl={false}
      attributionControl={false}
      className="w-full h-full"
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />

      <MapBoundsUpdater
        driverLat={driverLat}
        driverLng={driverLng}
        destLat={destLat ?? null}
        destLng={destLng ?? null}
        restaurantLat={restaurantLat}
        restaurantLng={restaurantLng}
        isExpanded={isExpanded}
      />

      {/* Route polyline — double-stroke for M3 elevation feel */}
      {route.length > 0 && (
        <>
          <Polyline positions={route} color={M3.onSurface} weight={8} opacity={0.12} />
          <Polyline positions={route} color={orderStatus === 'out-for-delivery' ? M3.primary : M3.secondary} weight={5} opacity={0.9} />
        </>
      )}

      {/* Driver marker — glides smoothly between GPS pings */}
      {hasDriver && (
        <SmoothDriverMarker lat={driverLat!} lng={driverLng!} icon={driverIcon} />
      )}

      {/* Restaurant marker */}
      {restaurantLat && restaurantLng && restaurantIcon && (
        <Marker position={[restaurantLat, restaurantLng]} icon={restaurantIcon} zIndexOffset={200} />
      )}

      {/* Customer / delivery destination marker */}
      {deliveryLat && deliveryLng && customerIcon && (
        <Marker position={[deliveryLat, deliveryLng]} icon={customerIcon} zIndexOffset={100} />
      )}
    </MapContainer>
  )

  /* ── Compact card (default) ───────────────────────────────────────── */
  if (!isExpanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        className="mx-4 mt-5 rounded-3xl overflow-hidden shadow-lg border border-slate-100"
        style={{ background: M3.surface }}
      >
        {/* Map */}
        <div className="relative h-52">
          {mapContent}

          {/* Expand button */}
          <button
            onClick={() => setIsExpanded(true)}
            className="absolute top-3 right-3 z-[500] w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95"
            style={{ background: M3.surface, color: M3.onSurface }}
            aria-label={t('Expand map', 'توسيع الخريطة')}
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Live / Connection badge */}
          <div
            className="absolute top-3 left-3 z-[500] flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm"
            style={{
              background: isLive ? M3.primaryContainer : '#f1f5f9',
              color: isLive ? M3.primary : M3.onSurfaceVariant,
            }}
          >
            {isLive ? (
              <>
                <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: M3.primary }} />
                {t('Live', 'مباشر')}
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                {t('Connecting…', 'جارٍ الاتصال…')}
              </>
            )}
          </div>
        </div>

        {/* Info bar */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* ETA / distance pill */}
            <div className="flex items-center gap-2 min-w-0">
              {routeLoading && <RotateCw className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: M3.onSurfaceVariant }} />}
              {routeDuration != null ? (
                <span className="text-sm font-black" style={{ color: M3.onSurface }}>
                  {formatMinutes(routeDuration)}
                </span>
              ) : null}
              {routeDistance != null ? (
                <span className="text-xs font-medium" style={{ color: M3.onSurfaceVariant }}>
                  · {formatDist(routeDistance)}
                </span>
              ) : straightLineKm != null ? (
                <span className="text-xs font-medium" style={{ color: M3.onSurfaceVariant }}>
                  ~{straightLineKm.toFixed(1)} km
                </span>
              ) : null}
            </div>

            {/* Legend pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              {pills.map((p) => (
                <span
                  key={p.label}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: `${p.color}18`, color: p.color }}
                >
                  {p.icon}
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  /* ── Full-screen expanded view ────────────────────────────────────── */
  return (
    <AnimatePresence>
      <motion.div
        key="expanded-map"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{ background: M3.surface, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Top bar */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
          style={{ background: M3.surface, borderColor: M3.outline }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Live indicator */}
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: isLive ? M3.primaryContainer : '#f1f5f9',
                color: isLive ? M3.primary : M3.onSurfaceVariant,
              }}
            >
              {isLive
                ? <><span className="h-2 w-2 rounded-full animate-pulse" style={{ background: M3.primary }} />{t('Live', 'مباشر')}</>
                : <><WifiOff className="h-3 w-3" />{t('Connecting', 'جارٍ الاتصال')}</>
              }
            </div>

            {/* ETA */}
            {routeDuration != null && (
              <span className="text-sm font-black truncate" style={{ color: M3.onSurface }}>
                {formatMinutes(routeDuration)}
                {routeDistance != null && (
                  <span className="font-normal text-xs ml-1" style={{ color: M3.onSurfaceVariant }}>
                    · {formatDist(routeDistance)}
                  </span>
                )}
              </span>
            )}
            {routeDuration == null && straightLineKm != null && (
              <span className="text-sm font-medium" style={{ color: M3.onSurfaceVariant }}>
                ~{straightLineKm.toFixed(1)} km
              </span>
            )}
            {routeLoading && <RotateCw className="h-3.5 w-3.5 animate-spin" style={{ color: M3.onSurfaceVariant }} />}
          </div>

          {/* Minimise */}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95"
            style={{ background: M3.surfaceVariant, color: M3.onSurface }}
            aria-label={t('Minimise map', 'تصغير الخريطة')}
          >
            <Minimize2 className="h-5 w-5" />
          </button>
        </div>

        {/* Map fills remaining space */}
        <div className="flex-1 min-h-0 relative">
          {mapContent}

          {/* Re-fit bounds FAB */}
          <button
            onClick={() => {
              // Re-trigger bounds fit by remounting the updater key — simplest approach
              // is just to scroll to the driver by re-setting isExpanded to the same value
              // We'll use a dedicated handler via the MapBoundsUpdater
            }}
            className="absolute bottom-24 right-4 z-[500] w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
            style={{ background: M3.surface, color: M3.primary }}
            aria-label={t('Re-centre', 'إعادة التمركز')}
          >
            <Locate className="h-5 w-5" />
          </button>
        </div>

        {/* Legend / info bottom sheet */}
        <div
          className="shrink-0 border-t px-4 pt-3 pb-4"
          style={{
            background: M3.surface,
            borderColor: M3.outline,
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          }}
        >
          {/* Status label */}
          <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: M3.onSurfaceVariant }}>
            {orderStatus === 'out-for-delivery'
              ? t('Driver heading to you', 'السائق في طريقه إليك')
              : t('Driver heading to restaurant', 'السائق في طريقه إلى المطعم')}
          </p>

          {/* Legend chips */}
          <div className="flex flex-wrap gap-2">
            {restaurantLat && restaurantLng && (
              <LegendChip icon={<Store className="h-3.5 w-3.5" />} label={restaurantName || t('Restaurant', 'المطعم')} color="#dc2626" />
            )}
            {hasDriver && (
              <LegendChip icon={<Navigation2 className="h-3.5 w-3.5" />} label={driverName || t('Driver', 'السائق')} color={M3.secondary} />
            )}
            {deliveryLat && deliveryLng && (
              <LegendChip icon={<MapPin className="h-3.5 w-3.5" />} label={t('Your location', 'موقعك')} color={M3.primary} />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function LegendChip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{ background: `${color}15`, color }}
    >
      {icon}
      {label}
    </span>
  )
}
