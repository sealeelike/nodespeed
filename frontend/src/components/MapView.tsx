import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Grayscale vector basemap: CARTO Positron style — free, no API key. Matches CF's
// muted map look. We center on the node and drop a marker at its coordinates.
const STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

export function MapView({ lat, lon, label }: { lat: number; lon: number; label: string }) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!elRef.current) return
    const map = new maplibregl.Map({
      container: elRef.current,
      style: STYLE,
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
  }, [lat, lon, label])

  return <div ref={elRef} className="h-64 w-full overflow-hidden rounded-lg border border-gray-200" />
}
