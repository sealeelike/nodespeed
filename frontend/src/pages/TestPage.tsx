import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import type SpeedTest from '@cloudflare/speedtest'
import type { PublicNode, ClientGeo } from '../types'
import { fetchNodes, fetchToken, fetchClientGeo } from '../api'
import { startTest, type LiveSnapshot, type FinalResult } from '../lib/speedtest'
import { SpeedPanel, AimScore } from '../components/SpeedPanel'
import { LatencySection, BandwidthSections, Section } from '../components/Measurements'
import { MapView } from '../components/MapView'
import { ConnectionInfo } from '../components/ConnectionInfo'
import { useLayout } from '../lib/layoutContext'

// Detail page: ?node=<id>. Auto-starts a speed test against that node, renders
// the live curves, AIM score, map (with all other nodes as dots) and box plots.
export function TestPage() {
  const [params] = useSearchParams()
  const nodeId = params.get('node')
  const { dark } = useLayout()

  const [nodes, setNodes] = useState<PublicNode[]>([])
  const [live, setLive] = useState<LiveSnapshot | null>(null)
  const [final, setFinal] = useState<FinalResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geo, setGeo] = useState<ClientGeo | null>(null)
  const [measuredAt, setMeasuredAt] = useState<string | null>(null)
  const engineRef = useRef<SpeedTest | null>(null)
  const startedFor = useRef<string | null>(null)

  const selected = nodes.find((n) => n.id === nodeId) ?? null

  // full node list: powers the selected-node lookup + the map's other-node dots
  useEffect(() => {
    fetchNodes().then(setNodes).catch((e) => setError(String(e)))
  }, [])

  // client geolocation is node-independent — resolve it once for the map pin + panel
  useEffect(() => {
    fetchClientGeo().then(setGeo).catch(() => setGeo(null))
  }, [])

  function runTest(n: PublicNode) {
    engineRef.current?.pause()
    setLive(null)
    setFinal(null)
    setError(null)
    setMeasuredAt(null)
    setRunning(true)
    fetchToken(n.id)
      .then((tok) => {
        engineRef.current = startTest(tok.url, tok.token, {
          onProgress: setLive,
          onFinish: (r) => {
            setFinal(r)
            setRunning(false)
            setMeasuredAt(new Date().toLocaleTimeString())
          },
          onError: (msg) => setError(msg),
        })
      })
      .catch((e) => {
        setError(String(e))
        setRunning(false)
      })
  }

  // auto-start once per node id (guard against StrictMode's double effect run)
  useEffect(() => {
    if (!selected) return
    if (startedFor.current === selected.id) return
    startedFor.current = selected.id
    runTest(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  // stop the engine on unmount / navigation away
  useEffect(() => () => {
    engineRef.current?.pause()
    engineRef.current = null
  }, [])

  const otherNodes = useMemo(
    () => nodes.map((n) => ({ id: n.id, lat: n.lat, lon: n.lon, name: n.name })),
    [nodes],
  )
  const snap = final ?? live

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/nodes" className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100">← Nodes</Link>
          {selected && (
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {selected.name || selected.id} · {selected.region}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {running ? (
            <span className="text-orange-600">Measuring…</span>
          ) : (
            measuredAt && <span className="text-gray-400">Measured at {measuredAt}</span>
          )}
          {selected && (
            <button
              onClick={() => runTest(selected)}
              disabled={running}
              className="bg-gray-100 px-3 py-1 font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
            >
              Retest
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>
      )}

      {!selected && nodes.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Unknown node <code>{nodeId}</code>. <Link to="/nodes" className="underline">Back to nodes</Link>.
        </div>
      )}

      {selected && (
        <>
          <SpeedPanel live={live} final={final} />
          <AimScore scores={final?.scores} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Section title="Server Location">
              <MapView
                lat={selected.lat}
                lon={selected.lon}
                label={selected.name || selected.id}
                clientLat={geo?.lat}
                clientLon={geo?.lon}
                dark={dark}
                selectedId={selected.id}
                otherNodes={otherNodes}
              />
              <ConnectionInfo node={selected} geo={geo} />
            </Section>
            {snap && <LatencySection snap={snap} />}
          </div>
          {snap && <BandwidthSections snap={snap} />}
        </>
      )}
    </section>
  )
}
