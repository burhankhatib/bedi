'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Minimize2, Navigation, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'

// Fix Leaflet default marker icon issue (often needed in Next.js)
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// Custom icons
const driverIcon = typeof window !== 'undefined' ? L.divIcon({
  html: `<div class="w-8 h-8 bg-blue-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
}) : null

const destIcon = typeof window !== 'undefined' ? L.divIcon({
  html: `<div class="w-8 h-8 bg-red-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
}) : null

function MapUpdater({ 
  driverLat, 
  driverLng, 
  destLat, 
  destLng, 
  route 
}: { 
  driverLat: number; driverLng: number; destLat: number; destLng: number; route: [number, number][] 
}) {
  const map = useMap()
  
  useEffect(() => {
    if (driverLat && driverLng && destLat && destLng) {
      const bounds = L.latLngBounds([driverLat, driverLng], [destLat, destLng])
      map.fitBounds(bounds, { padding: [50, 50] })
    } else if (driverLat && driverLng) {
      map.setView([driverLat, driverLng], 15)
    }
  }, [driverLat, driverLng, destLat, destLng, map, route])

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

  // Fetch route from OSRM
  useEffect(() => {
    if (!driverLat || !driverLng || !destLat || !destLng) {
      setRoute([])
      return
    }

    const fetchRoute = async () => {
      setRouteLoading(true)
      setRouteError(false)
      try {
        // OSRM expects longitude,latitude
        const url = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${destLng},${destLat}?overview=full&geometries=geojson`
        const res = await fetch(url)
        const data = await res.json()
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          // OSRM returns coordinates as [longitude, latitude]
          const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number])
          setRoute(coords)
        } else {
          setRouteError(true)
        }
      } catch (err) {
        console.error('Error fetching route:', err)
        setRouteError(true)
      } finally {
        setRouteLoading(false)
      }
    }

    fetchRoute()
    
    // Refresh route every 30 seconds
    const interval = setInterval(fetchRoute, 30000)
    return () => clearInterval(interval)
  }, [driverLat, driverLng, destLat, destLng])

  if (!driverLat || !driverLng) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center text-white">
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
    <div className="fixed inset-0 z-[100] bg-slate-100 flex flex-col">
      {/* Header Bar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between safe-top absolute top-0 left-0 right-0 z-[9999] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-slate-900 leading-tight">
              {destinationLabel ? t(`Navigating to ${destinationLabel}`, `التوجه إلى ${destinationLabel}`) : t('Navigation', 'التنقل')}
            </h2>
            {routeLoading && (
              <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                <Loader2 className="w-3 h-3 animate-spin" /> {t('Updating route...', 'تحديث المسار...')}
              </p>
            )}
            {routeError && !routeLoading && (
              <p className="text-xs font-bold text-amber-600 mt-0.5">
                {t('Could not find route', 'تعذر العثور على مسار')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={onMinimize} 
            variant="outline" 
            size="icon" 
            className="rounded-full w-10 h-10 border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm"
          >
            <Minimize2 className="w-5 h-5" />
          </Button>
          <Button 
            onClick={onClose} 
            variant="outline" 
            size="icon" 
            className="rounded-full w-10 h-10 border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative w-full h-full">
        <MapContainer 
          center={center} 
          zoom={15} 
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          <MapUpdater 
            driverLat={driverLat} 
            driverLng={driverLng} 
            destLat={destLat!} 
            destLng={destLng!} 
            route={route} 
          />

          {/* Driver Marker */}
          {driverIcon && (
            <Marker position={[driverLat, driverLng]} icon={driverIcon} zIndexOffset={100} />
          )}

          {/* Destination Marker */}
          {destLat && destLng && destIcon && (
            <Marker position={[destLat, destLng]} icon={destIcon} zIndexOffset={90} />
          )}

          {/* Route Polyline */}
          {route.length > 0 && (
            <>
              {/* Outer stroke for contrast */}
              <Polyline positions={route} color="#ffffff" weight={8} opacity={0.8} />
              {/* Inner route line */}
              <Polyline positions={route} color="#3b82f6" weight={5} opacity={0.9} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
