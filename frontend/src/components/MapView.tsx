import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Grayscale vector basemaps: CARTO Positron (light) / Dark Matter (dark) — free,
// no API key. Matches CF's muted map look. We drop a red pin on the node and, if
// the client's IP geolocation is known, a dot on "you" plus a curved arc between.
const LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const ORANGE = '#f6821f'

// shift `toLon` by whole turns so it's within 180° of `fromLon` — makes the arc
// take the short way around the globe (SJC→HKG across the Pacific, not Europe).
function unwrapLon(fromLon: number, toLon: number): number {
  let d = toLon - fromLon
  while (d > 180) { toLon -= 360; d = toLon - fromLon }
  while (d < -180) { toLon += 360; d = toLon - fromLon }
  return toLon
}

// a gently bowed line between two [lng,lat] points, for a nice arc
function arcLine(a: [number, number], b: [number, number], n = 64): [number, number][] {
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1])
  const bow = dist * 0.15
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * bow])
  }
  return pts
}

export function MapView({
  lat,
  lon,
  label,
  clientLat,
  clientLon,
  dark = false,
}: {
  lat: number
  lon: number
  label: string
  clientLat?: number
  clientLon?: number
  dark?: boolean
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!elRef.current) return
    const hasClient = clientLat != null && clientLon != null
    const node: [number, number] = [lon, lat]
    const client: [number, number] = [clientLon ?? lon, clientLat ?? lat]
    // node longitude unwrapped relative to the client, so the arc + framing take
    // the short (trans-Pacific) path instead of wrapping across Europe.
    const nodeArc: [number, number] = [unwrapLon(client[0], lon), lat]

    const map = new maplibregl.Map({
      container: elRef.current,
      style: dark ? DARK : LIGHT,
      center: node,
      zoom: 3,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    // collapse the attribution to just the ⓘ toggle by default (click still expands)
    map.on('load', () => {
      map.getContainer()
        .querySelector('.maplibregl-ctrl-attrib')
        ?.classList.remove('maplibregl-compact-show')
    })

    // node marker (red pin)
    new maplibregl.Marker({ color: '#ef4444' }).setLngLat(node)
      .setPopup(new maplibregl.Popup({ offset: 16 }).setText(label)).addTo(map)

    if (hasClient) {
      // client marker (blue dot)
      new maplibregl.Marker({ color: '#3b82f6' }).setLngLat(client)
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText('You')).addTo(map)

      map.on('load', () => {
        map.addSource('arc', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arcLine(client, nodeArc) } },
        })
        map.addLayer({
          id: 'arc', type: 'line', source: 'arc',
          paint: { 'line-color': ORANGE, 'line-width': 2, 'line-opacity': 0.8 },
        })
      })

      // frame both points using the unwrapped node so the view centers on the Pacific
      const b = new maplibregl.LngLatBounds().extend(nodeArc).extend(client)
      map.fitBounds(b, { padding: 60, maxZoom: 6, duration: 0 })
    }

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [lat, lon, label, clientLat, clientLon, dark])

  return <div ref={elRef} className="h-64 w-full overflow-hidden" />
}
