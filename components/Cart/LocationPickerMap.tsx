'use client'

import { useEffect, useRef, useMemo, type RefObject } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import { Crosshair, Locate, Loader2 } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet marker icon issue in Next.js/Webpack
const customIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center)
  }, [center, map])
  return null
}

function MapClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Re-centers the map view on the draggable pin (does not call GPS). */
function CenterMapOnPinButton({
  markerRef,
  onChange,
  ariaLabel,
}: {
  markerRef: RefObject<L.Marker | null>
  onChange: (lat: number, lng: number) => void
  ariaLabel: string
}) {
  const map = useMap()
  const handleMapCenter = () => {
    const marker = markerRef.current
    if (marker) {
      const position = marker.getLatLng()
      onChange(position.lat, position.lng)
      map.setView([position.lat, position.lng])
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleMapCenter()
      }}
      className="pointer-events-auto absolute bottom-4 end-4 z-[1000] flex size-11 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-800 shadow-lg transition-colors hover:bg-slate-50"
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <Crosshair className="size-5" aria-hidden />
    </button>
  )
}

/** Calls parent to run GPS (same as checkout "Share / Refresh location"). */
function MyLocationFab({
  onRequestMyLocation,
  locationLoading,
  ariaLabel,
}: {
  onRequestMyLocation: () => void
  locationLoading: boolean
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!locationLoading) onRequestMyLocation()
      }}
      disabled={locationLoading}
      className="pointer-events-auto absolute bottom-4 start-4 z-[1000] flex size-11 items-center justify-center rounded-full border border-emerald-200/90 bg-emerald-600 text-white shadow-lg transition-colors hover:bg-emerald-700 disabled:opacity-70"
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      {locationLoading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Locate className="size-5" aria-hidden />}
    </button>
  )
}

export default function LocationPickerMap({
  lat,
  lng,
  onChange,
  onRequestMyLocation,
  locationLoading = false,
  gpsAriaLabel = 'Use my current location',
  centerPinAriaLabel = 'Center map on pin',
}: {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  /** GPS refresh — must be wired to the same handler as checkout "Share my location". */
  onRequestMyLocation?: () => void
  locationLoading?: boolean
  gpsAriaLabel?: string
  centerPinAriaLabel?: string
}) {
  const markerRef = useRef<L.Marker | null>(null)

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker != null) {
          const position = marker.getLatLng()
          onChange(position.lat, position.lng)
        }
      },
    }),
    [onChange]
  )

  return (
    <div className="relative isolate z-0 h-full w-full overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onChange={onChange} />
        <Marker
          draggable={true}
          autoPan={true}
          eventHandlers={eventHandlers}
          position={[lat, lng]}
          ref={markerRef}
          icon={customIcon}
        />
        <MapUpdater center={[lat, lng]} />
        {onRequestMyLocation ? (
          <MyLocationFab
            onRequestMyLocation={onRequestMyLocation}
            locationLoading={locationLoading}
            ariaLabel={gpsAriaLabel}
          />
        ) : null}
        <CenterMapOnPinButton markerRef={markerRef} onChange={onChange} ariaLabel={centerPinAriaLabel} />
      </MapContainer>
    </div>
  )
}
