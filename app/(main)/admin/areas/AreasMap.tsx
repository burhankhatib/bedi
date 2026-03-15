'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Loader2, Save, Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false })

// Geoman must be loaded before any Leaflet map/layers are created
const geomanPromise =
  typeof window !== 'undefined'
    ? import('@geoman-io/leaflet-geoman-free')
    : Promise.resolve()

if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

type GeoJSONFeature = {
  type: 'Feature'
  properties: { name: string; centroid?: { lat: number; lng: number } }
  geometry: {
    type: 'Polygon'
    coordinates: [number, number][][]
  }
}

type GeoJSON = {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

const DEFAULT_CENTER: [number, number] = [31.95, 35.2]
const DEFAULT_ZOOM = 9

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && map) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 })
  }, [bounds, map])
  return null
}

/** Zoom map to a specific feature's bounds when selectedCity changes. */
function ZoomToFeature({
  geojson,
  selectedCity,
}: {
  geojson: GeoJSON
  selectedCity: string | null
}) {
  const map = useMap()
  useEffect(() => {
    if (!selectedCity || !geojson?.features?.length || !map) return
    const feature = geojson.features.find((f) => f.properties.name === selectedCity)
    if (!feature?.geometry?.coordinates?.[0]?.length) return
    const coords = feature.geometry.coordinates[0]
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
    for (const [lng, lat] of coords) {
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
    }
    const featureBounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng])
    map.fitBounds(featureBounds, { padding: [48, 48], maxZoom: 15 })
  }, [selectedCity, geojson, map])
  return null
}

function MapLayers({
  geojson,
  selectedCity,
  onSelectCity,
  onEditEnd,
  onAreaDrawn,
}: {
  geojson: GeoJSON
  selectedCity: string | null
  onSelectCity: (name: string) => void
  onEditEnd: (name: string, coordinates: [number, number][]) => void
  onAreaDrawn: (layer: L.Polygon) => void
}) {
  const map = useMap()
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const layerToNameRef = useRef<Map<L.Polygon, string>>(new Map())
  const onEditEndRef = useRef(onEditEnd)
  const onSelectCityRef = useRef(onSelectCity)
  const onAreaDrawnRef = useRef(onAreaDrawn)
  onEditEndRef.current = onEditEnd
  onSelectCityRef.current = onSelectCity
  onAreaDrawnRef.current = onAreaDrawn

  useEffect(() => {
    if (!geojson || !map) return
    if (typeof window === 'undefined') return

    geomanPromise.then(() => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current)
        layerGroupRef.current = null
        layerToNameRef.current.clear()
      }

      if (!map.pm.controlsVisible()) {
        map.pm.addControls({
          position: 'topleft',
          drawControls: true,
          drawMarker: false,
          drawCircleMarker: false,
          drawPolyline: false,
          drawRectangle: false,
          drawCircle: false,
          drawPolygon: true,
          editControls: true,
          editMode: true,
          removalMode: false,
        })
      }

      const handleCreate = (e: L.LeafletEvent & { layer?: L.Layer }) => {
        const layer = e.layer as L.Polygon
        if (layer && typeof layer.getLatLngs === 'function') {
          onAreaDrawnRef.current(layer)
        }
      }
      map.on('pm:create', handleCreate)

      const group = L.layerGroup().addTo(map)
      layerGroupRef.current = group

      const handleEdit = (e: L.LeafletEvent & { layer?: L.Polygon }) => {
        const layer = (e.layer ?? e.target) as L.Polygon
        const name = (layer as L.Polygon & { __areaName?: string }).__areaName ?? layerToNameRef.current.get(layer)
        if (!name) return
        const latLngs = layer.getLatLngs()
        const ring = Array.isArray(latLngs[0]) ? (latLngs[0] as L.LatLng[]) : (latLngs as L.LatLng[])
        const coords: [number, number][] = ring.map((ll) => [ll.lng, ll.lat])
        if (coords.length >= 3) onEditEndRef.current(name, coords)
      }
      map.on('pm:edit', handleEdit)

      for (const feature of geojson.features ?? []) {
        const coords = feature.geometry.coordinates[0]
        if (!coords?.length) continue
        const name = feature.properties.name
        const latLngs = coords.map(([lng, lat]) => L.latLng(lat, lng))

        const polygon = L.polygon(latLngs, {
          color: selectedCity === name ? '#f59e0b' : '#38bdf8',
          fillColor: selectedCity === name ? '#f59e0b' : '#38bdf8',
          fillOpacity: 0.2,
          weight: 2,
        })
        ;(polygon as L.Polygon & { __areaName?: string }).__areaName = name
        layerToNameRef.current.set(polygon, name)
        polygon.on('click', () => onSelectCityRef.current(name))
        polygon.on('pm:markerdragend', handleEdit)
        polygon.addTo(group)

        polygon.pm.enable()
      }

      return () => {
        map.off('pm:edit', handleEdit)
        map.off('pm:create', handleCreate)
        if (map.pm.controlsVisible()) map.pm.removeControls()
      }
    })
  }, [geojson, map])

  useEffect(() => {
    if (!layerGroupRef.current || !selectedCity) return
    const layers = layerGroupRef.current.getLayers() as L.Polygon[]
    for (const layer of layers) {
      const name = (layer as L.Polygon & { __areaName?: string }).__areaName ?? layerToNameRef.current.get(layer)
      if (!name) continue
      const isSelected = name === selectedCity
      layer.setStyle({
        color: isSelected ? '#f59e0b' : '#38bdf8',
        fillColor: isSelected ? '#f59e0b' : '#38bdf8',
      })
    }
  }, [selectedCity])

  return null
}

export function AreasMap() {
  const [geomanReady, setGeomanReady] = useState(false)
  const [geojson, setGeojson] = useState<GeoJSON | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    geomanPromise.then(() => setGeomanReady(true))
  }, [])
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [pendingEdit, setPendingEdit] = useState<{ name: string; coordinates: [number, number][] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [newAreaLayer, setNewAreaLayer] = useState<L.Polygon | null>(null)
  const [newAreaName, setNewAreaName] = useState('')
  const [creating, setCreating] = useState(false)
  const [renameArea, setRenameArea] = useState<{ currentName: string; newName: string } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  const fetchData = () => {
    setLoading(true)
    fetch('/api/admin/areas/platform', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setGeojson(data))
      .catch(() => setGeojson(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleEditEnd = (name: string, coordinates: [number, number][]) => {
    setPendingEdit({ name, coordinates })
  }

  const handleAreaDrawn = (layer: L.Polygon) => {
    setNewAreaLayer(layer)
    setNewAreaName('')
  }

  const handleCreateArea = async () => {
    if (!newAreaLayer || !newAreaName.trim()) return
    const latLngs = newAreaLayer.getLatLngs()
    const ring = Array.isArray(latLngs[0]) ? (latLngs[0] as L.LatLng[]) : (latLngs as L.LatLng[])
    const coords: [number, number][] = ring.map((ll) => [ll.lng, ll.lat])
    if (coords.length < 3) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/areas/platform', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newAreaName.trim(), coordinates: coords }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        newAreaLayer.remove()
        setNewAreaLayer(null)
        setNewAreaName('')
        fetchData()
      } else {
        console.error('Create failed:', data)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleCancelNewArea = () => {
    if (newAreaLayer) {
      newAreaLayer.remove()
      setNewAreaLayer(null)
    }
    setNewAreaName('')
  }

  const handleRenameArea = async () => {
    if (!renameArea || !renameArea.newName.trim()) return
    setRenameError(null)
    setRenaming(true)
    try {
      const res = await fetch('/api/admin/areas/platform', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: renameArea.currentName, newName: renameArea.newName.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setRenameArea(null)
        setRenameError(null)
        fetchData()
      } else {
        setRenameError(typeof data?.error === 'string' ? data.error : 'Rename failed')
      }
    } finally {
      setRenaming(false)
    }
  }

  const handleSave = async () => {
    if (!pendingEdit) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/areas/platform', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: pendingEdit.name, coordinates: pendingEdit.coordinates }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setPendingEdit(null)
        fetchData()
      } else {
        console.error('Save failed:', data)
      }
    } finally {
      setSaving(false)
    }
  }

  const bounds = useMemo(() => {
    if (!geojson?.features?.length) return null
    let minLat = 90
    let maxLat = -90
    let minLng = 180
    let maxLng = -180
    for (const f of geojson.features) {
      const coords = f.geometry.coordinates[0] ?? []
      for (const [lng, lat] of coords) {
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
      }
    }
    if (minLat === 90) return null
    return L.latLngBounds([minLat, minLng], [maxLat, maxLng])
  }, [geojson])

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/50">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!geomanReady) {
    return (
      <div className="flex h-[800px] items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/50">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    )
  }

  const hasAreas = (geojson?.features?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {hasAreas
            ? 'Click a city to zoom in, use Edit (pencil) to modify, or Draw (polygon icon) to add a new area.'
            : 'Draw a polygon on the map to add your first platform area.'}
        </p>
        {pendingEdit && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/50 bg-slate-800/80 px-4 py-2.5">
            <span className="text-sm font-medium text-amber-300">Unsaved edits to {pendingEdit.name}</span>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-600 text-white hover:bg-amber-700 shrink-0"
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save
            </Button>
          </div>
        )}
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50" style={{ height: 800 }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%', background: '#0f172a' }}
        >
          {hasAreas && <FitBounds bounds={bounds} />}
          {hasAreas && geojson && <ZoomToFeature geojson={geojson} selectedCity={selectedCity} />}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapLayers
            geojson={geojson ?? { type: 'FeatureCollection', features: [] }}
            selectedCity={selectedCity}
            onSelectCity={setSelectedCity}
            onEditEnd={handleEditEnd}
            onAreaDrawn={handleAreaDrawn}
          />
        </MapContainer>
      </div>
      <Dialog open={!!newAreaLayer} onOpenChange={(open) => { if (!open) handleCancelNewArea() }}>
        <DialogContent
          className="border-slate-700 border-amber-500/30 bg-slate-900 text-white shadow-2xl ring-2 ring-amber-500/40 sm:max-w-md"
          overlayClassName="z-[9999] bg-black/80"
          contentClassName="z-[10000]"
        >
          <DialogHeader>
            <DialogTitle>Name the new area</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter a name for this platform area (e.g. city or neighborhood name). It will be used for geofencing.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="e.g. New City"
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateArea()}
            autoFocus
            className="mt-4 border-slate-600 bg-slate-800 text-white placeholder:text-slate-500"
          />
          <DialogFooter className="gap-2 sm:gap-0 mt-6">
            <Button variant="outline" onClick={handleCancelNewArea} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleCreateArea}
              disabled={!newAreaName.trim() || creating}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
              Add area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!renameArea} onOpenChange={(open) => { if (!open) { setRenameArea(null); setRenameError(null) } }}>
        <DialogContent
          className="border-slate-700 border-amber-500/30 bg-slate-900 text-white shadow-2xl ring-2 ring-amber-500/40 sm:max-w-md"
          overlayClassName="z-[9999] bg-black/80"
          contentClassName="z-[10000]"
        >
          <DialogHeader>
            <DialogTitle>Rename area</DialogTitle>
            <DialogDescription className="text-slate-400">
              Change the area name (used for geofencing).
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="New name"
            value={renameArea?.newName ?? ''}
            onChange={(e) => { renameArea && setRenameArea({ ...renameArea, newName: e.target.value }); setRenameError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameArea()}
            autoFocus
            className={`mt-4 border-slate-600 bg-slate-800 text-white placeholder:text-slate-500 ${renameError ? 'border-red-500/60' : ''}`}
          />
          {renameError && (
            <p className="mt-2 text-sm text-red-400">{renameError}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0 mt-6">
            <Button variant="outline" onClick={() => { setRenameArea(null); setRenameError(null) }} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleRenameArea}
              disabled={!renameArea?.newName?.trim() || renaming || (renameArea?.newName?.trim() === renameArea?.currentName)}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {renaming ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Pencil className="mr-2 size-4" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-wrap gap-2">
        {(geojson?.features ?? []).map((f) => (
          <div
            key={f.properties.name}
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              selectedCity === f.properties.name
                ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                : 'border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'
            }`}
          >
            <button
              type="button"
              onClick={() => setSelectedCity(f.properties.name)}
              className="flex items-center gap-2"
            >
              <MapPin className="size-4 shrink-0" />
              {f.properties.name}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setRenameArea({ currentName: f.properties.name, newName: f.properties.name }); setRenameError(null) }}
              className="rounded p-0.5 hover:bg-slate-700/60 transition-colors"
              title="Rename area"
              aria-label="Rename"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
