import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Grayscale vector basemaps: CARTO Positron (light) / Dark Matter (dark) — free,
// no API key. Matches CF's muted map look. Centered on the node with a marker.
const LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export function MapView({ lat, lon, label, dark = false }: { lat: number; lon: number; label: string; dark?: boolean }) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!elRef.current) return
    const map = new maplibregl.Map({
      container: elRef.current,
      style: dark ? DARK : LIGHT,
      center: [lon, lat],
      zoom: 3.5,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    new maplibregl.Marker({ color: '#ef4444' }).setLngLat([lon, lat])
      .setPopup(new maplibregl.Popup({ offset: 16 }).setText(label))
      .addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [lat, lon, label, dark])

  return <div ref={elRef} className="h-64 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800" />
}
