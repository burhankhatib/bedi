'use client'

import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
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
  shadowSize: [41, 41]
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

function CenterMapToMarker({ markerRef, onChange }: { markerRef: React.RefObject<L.Marker | null>, onChange: (lat: number, lng: number) => void }) {
  const map = useMap()
  const handleMapCenter = () => {
    const marker = markerRef.current;
    if (marker) {
       const position = marker.getLatLng();
       onChange(position.lat, position.lng);
       map.setView([position.lat, position.lng]);
    }
  };
  
  return (
    <button 
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMapCenter();
      }}
      className="absolute bottom-4 right-4 z-[400] bg-white text-slate-800 p-2 rounded-full shadow-lg border border-slate-200/50 hover:bg-slate-50 transition-colors flex items-center justify-center cursor-pointer"
      title="Center map to marker"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-crosshair"><circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/></svg>
    </button>
  )
}

export default function LocationPickerMap({
  lat,
  lng,
  onChange,
}: {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
}) {
  const markerRef = useRef<L.Marker>(null)
  
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
    <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-200 z-0 relative isolate">
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
        <CenterMapToMarker markerRef={markerRef} onChange={onChange} />
      </MapContainer>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[400] pointer-events-none text-xs font-bold bg-white/90 text-slate-800 px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm shadow-black/10 border border-slate-200/50 flex flex-col items-center">
        <span>{lat === 0 ? 'Click to set location' : 'Drag the pin or click on the map to adjust'}</span>
        <span className="text-[10px] text-slate-500 font-medium">اسحب الدبوس أو انقر على الخريطة للتعديل</span>
      </div>
    </div>
  )
}
