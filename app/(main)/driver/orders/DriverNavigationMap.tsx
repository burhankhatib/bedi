'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Minimize2, Navigation, Loader2, X, Locate, RotateCw } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
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
 * Navigation-style map updater (Waze / Google Maps feel).
 * In follow mode, positions the driver in the bottom quarter of the map
 * so the road ahead is visible.  Accounts for top & bottom UI bars.
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
      const usableHeight = mapSize.y - topBarPx - bottomBarPx
      const targetPoint = map.project([driverLat, driverLng], zoom)
      // Place the driver at ~75% down in the usable area (bottom quarter),
      // shifted upward by the top bar offset.
      const driverYInUsable = usableHeight * 0.75
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
}: DriverNavigationMapProps) {
  const { t } = useLanguage()
  const [route, setRoute] = useState<[number, number][]>([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const [routeDistance, setRouteDistance] = useState<number | null>(null)
  const [routeDuration, setRouteDuration] = useState<number | null>(null)
  const [followDriver, setFollowDriver] = useState(true)

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

      {/* ── Bottom Card — ETA & Distance ────────────── */}
      {(routeDistance != null || straightLineKm != null) && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[9999] bg-slate-900/95 backdrop-blur-md border-t border-slate-700/60"
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
