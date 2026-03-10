'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Minimize2, Navigation, Loader2, X, Locate, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

const DRIVER_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`

const driverIcon = typeof window !== 'undefined' ? L.divIcon({
  html: `<div style="width:40px;height:40px;background:#2563eb;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">${DRIVER_ICON_SVG}</div>`,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
}) : null

const destIcon = typeof window !== 'undefined' ? L.divIcon({
  html: `<div style="width:36px;height:36px;background:#dc2626;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
}) : null

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

/**
 * Driver-centric map updater.
 * When followDriver is true, keeps the driver at center-bottom of the viewport
 * and zooms to a level appropriate for navigation.
 * When followDriver is false, fits both points on screen.
 */
function MapUpdater({ 
  driverLat, 
  driverLng, 
  destLat, 
  destLng, 
  route,
  followDriver,
  onUserInteraction,
}: { 
  driverLat: number
  driverLng: number
  destLat: number
  destLng: number
  route: [number, number][]
  followDriver: boolean
  onUserInteraction: () => void
}) {
  const map = useMap()
  const isUserDragging = useRef(false)
  const hasSetInitialView = useRef(false)

  // Listen for user drag to disable follow mode
  useEffect(() => {
    const onDragStart = () => {
      isUserDragging.current = true
      onUserInteraction()
    }
    const onZoomStart = () => {
      // Only count as user interaction if it's manual (not programmatic)
      if (!map.options.zoomAnimation) return
    }
    map.on('dragstart', onDragStart)
    map.on('zoomstart', onZoomStart)
    return () => {
      map.off('dragstart', onDragStart)
      map.off('zoomstart', onZoomStart)
    }
  }, [map, onUserInteraction])

  useEffect(() => {
    if (!driverLat || !driverLng) return

    if (followDriver) {
      isUserDragging.current = false

      // Calculate appropriate zoom based on distance to destination
      let zoom = 16
      if (destLat && destLng) {
        const dist = distanceKm({ lat: driverLat, lng: driverLng }, { lat: destLat, lng: destLng })
        if (dist > 10) zoom = 12
        else if (dist > 5) zoom = 13
        else if (dist > 2) zoom = 14
        else if (dist > 0.5) zoom = 15
        else zoom = 17
      }

      // Offset the driver position to be at the bottom third of the viewport
      const mapSize = map.getSize()
      const targetPoint = map.project([driverLat, driverLng], zoom)
      // Shift up by 1/3 of viewport height so driver appears in bottom third
      const offsetPoint = L.point(targetPoint.x, targetPoint.y + mapSize.y * 0.25)
      const offsetLatLng = map.unproject(offsetPoint, zoom)

      if (!hasSetInitialView.current) {
        map.setView(offsetLatLng, zoom, { animate: false })
        hasSetInitialView.current = true
      } else {
        map.setView(offsetLatLng, zoom, { animate: true, duration: 1 })
      }
    } else if (!hasSetInitialView.current) {
      // First render without follow: fit both points
      if (destLat && destLng) {
        const bounds = L.latLngBounds([driverLat, driverLng], [destLat, destLng])
        map.fitBounds(bounds, { padding: [60, 60] })
      } else {
        map.setView([driverLat, driverLng], 15)
      }
      hasSetInitialView.current = true
    }
  }, [driverLat, driverLng, destLat, destLng, map, followDriver])

  return null
}

interface DriverNavigationMapProps {
  driverLat: number | null
  driverLng: number | null
  destLat: number | null
  destLng: number | null
  onMinimize: () => void
  onClose: () => void
  destinationLabel?: string
}

export default function DriverNavigationMap({
  driverLat,
  driverLng,
  destLat,
  destLng,
  onMinimize,
  onClose,
  destinationLabel
}: DriverNavigationMapProps) {
  const { t } = useLanguage()
  const [route, setRoute] = useState<[number, number][]>([])
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const [routeDistance, setRouteDistance] = useState<number | null>(null) // meters
  const [routeDuration, setRouteDuration] = useState<number | null>(null) // seconds
  const [followDriver, setFollowDriver] = useState(true)

  const handleRecenter = useCallback(() => {
    setFollowDriver(true)
  }, [])

  const handleUserInteraction = useCallback(() => {
    setFollowDriver(false)
  }, [])

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
          const coords = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number])
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

  // Calculate straight-line distance as fallback
  const straightLineKm = driverLat && driverLng && destLat && destLng
    ? distanceKm({ lat: driverLat, lng: driverLng }, { lat: destLat, lng: destLng })
    : null

  if (!driverLat || !driverLng) {
    return (
      <div 
        className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center text-white"
        style={{ paddingTop: 'max(16px, calc(env(safe-area-inset-top, 0px) + 12px))' }}
      >
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-emerald-500" />
        <p className="font-bold">{t('Locating driver...', 'جاري تحديد موقع السائق...')}</p>
        <Button onClick={onMinimize} variant="ghost" className="mt-6 text-slate-400">
          {t('Close', 'إغلاق')}
        </Button>
      </div>
    )
  }

  const center: [number, number] = [driverLat, driverLng]

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col">
      {/* Top Bar - Destination info */}
      <div 
        className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 px-4 flex items-center justify-between absolute top-0 left-0 right-0 z-[9999] shadow-lg"
        style={{ paddingTop: 'max(12px, calc(env(safe-area-inset-top, 0px) + 8px))', paddingBottom: '10px' }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-white leading-tight text-sm truncate">
              {destinationLabel || t('Navigation', 'التنقل')}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {routeDistance != null && routeDuration != null ? (
                <>
                  <span className="text-emerald-400 text-xs font-bold">{formatDistance(routeDistance)}</span>
                  <span className="text-slate-500 text-xs">·</span>
                  <span className="text-sky-400 text-xs font-bold">{formatDuration(routeDuration)}</span>
                </>
              ) : straightLineKm != null ? (
                <span className="text-slate-400 text-xs font-medium">{straightLineKm.toFixed(1)} km {t('away', 'بعيد')}</span>
              ) : null}
              {routeLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-400 ml-1" />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button 
            onClick={onMinimize} 
            variant="ghost" 
            size="icon" 
            className="rounded-full w-9 h-9 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button 
            onClick={onClose} 
            variant="ghost" 
            size="icon" 
            className="rounded-full w-9 h-9 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative w-full h-full">
        <MapContainer 
          center={center} 
          zoom={16} 
          zoomControl={false}
          className="w-full h-full"
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          <MapUpdater 
            driverLat={driverLat} 
            driverLng={driverLng} 
            destLat={destLat!} 
            destLng={destLng!} 
            route={route}
            followDriver={followDriver}
            onUserInteraction={handleUserInteraction}
          />

          {/* Driver Marker */}
          {driverIcon && (
            <Marker position={[driverLat, driverLng]} icon={driverIcon} zIndexOffset={200} />
          )}

          {/* Destination Marker */}
          {destLat && destLng && destIcon && (
            <Marker position={[destLat, destLng]} icon={destIcon} zIndexOffset={100} />
          )}

          {/* Route Polyline */}
          {route.length > 0 && (
            <>
              <Polyline positions={route} color="#1e293b" weight={9} opacity={0.3} />
              <Polyline positions={route} color="#3b82f6" weight={5} opacity={1} />
            </>
          )}
        </MapContainer>

        {/* Re-center button - only shown when user has panned away */}
        {!followDriver && (
          <button
            onClick={handleRecenter}
            className="absolute bottom-28 right-4 z-[500] w-12 h-12 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-blue-600 active:scale-95 transition-transform"
            title={t('Re-center on driver', 'إعادة التمركز على السائق')}
          >
            <Locate className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Card - ETA & distance summary */}
      {(routeDistance != null || straightLineKm != null) && (
        <div 
          className="absolute bottom-0 left-0 right-0 z-[9999] bg-slate-900/95 backdrop-blur-md border-t border-slate-700/60"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {routeDuration != null && (
                <div className="text-center">
                  <p className="text-2xl font-black text-white leading-none">
                    {routeDuration < 60 ? '<1' : Math.round(routeDuration / 60)}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{t('MIN', 'دقيقة')}</p>
                </div>
              )}
              {routeDistance != null && (
                <div className="text-center">
                  <p className="text-2xl font-black text-emerald-400 leading-none">
                    {formatDistance(routeDistance)}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{t('DISTANCE', 'المسافة')}</p>
                </div>
              )}
              {routeError && !routeLoading && (
                <p className="text-xs font-bold text-amber-400">
                  {t('Route unavailable', 'المسار غير متاح')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {routeLoading && (
                <div className="flex items-center gap-1 text-slate-400">
                  <RotateCw className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
