import { useEffect, useRef, useState } from 'react'
import type SpeedTest from '@cloudflare/speedtest'
import type { PublicNode, NodeConn, NodeMeta } from './types'
import { fetchNodes, fetchToken, fetchMeta, ackNode } from './api'
import { startTest, type LiveSnapshot, type FinalResult } from './lib/speedtest'
import { NodeList } from './components/NodeList'
import { SpeedPanel, AimScore } from './components/SpeedPanel'
import { LatencySection, BandwidthSections, Section } from './components/Measurements'
import { MapView } from './components/MapView'
import { ConnectionInfo } from './components/ConnectionInfo'
import { useDarkMode } from './lib/theme'

export default function App() {
  const [nodes, setNodes] = useState<PublicNode[]>([])
  const [conns, setConns] = useState<Record<string, NodeConn>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [live, setLive] = useState<LiveSnapshot | null>(null)
  const [final, setFinal] = useState<FinalResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<NodeMeta | null>(null)
  const [measuredAt, setMeasuredAt] = useState<string | null>(null)
  const [dark, toggleDark] = useDarkMode()
  const engineRef = useRef<SpeedTest | null>(null)

  // load node list, then ack each node for connectivity
  useEffect(() => {
    fetchNodes()
      .then((ns) => {
        setNodes(ns)
        setConns(Object.fromEntries(ns.map((n) => [n.id, { status: 'checking' as const }])))
        ns.forEach(async (n) => {
          const c = await ackNode(n.id)
          setConns((prev) => ({ ...prev, [n.id]: c }))
        })
      })
      .catch((e) => setError(String(e)))
  }, [])

  async function runTest(n: PublicNode) {
    engineRef.current?.pause()
    setSelectedId(n.id)
    setLive(null)
    setFinal(null)
    setError(null)
    setMeasuredAt(null)
    setRunning(true)
    fetchMeta(n.id).then(setMeta).catch(() => setMeta(null))
    try {
      const tok = await fetchToken(n.id)
      engineRef.current = startTest(tok.url, tok.token, {
        onProgress: setLive,
        onFinish: (r) => {
          setFinal(r)
          setRunning(false)
          setMeasuredAt(new Date().toLocaleTimeString())
        },
        onError: (msg) => setError(msg),
      })
    } catch (e) {
      setError(String(e))
      setRunning(false)
    }
  }

  const selected = nodes.find((n) => n.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <header className="mb-6 flex items-start justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">NetQualityPanel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Link quality from your browser to your own VPS nodes</p>
        </div>
        <button
          onClick={toggleDark}
          className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
          title="Toggle dark mode"
          aria-label="Toggle dark mode"
        >
          {dark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </header>

      {error && (
        <div className="mb-4 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Nodes</h2>
        <NodeList
          nodes={nodes}
          conns={conns}
          selectedId={selectedId}
          onSelect={runTest}
          disabled={running}
        />
      </section>

      {selected && (
        <section className="space-y-6">
          {/* control bar */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {selected.name} · {selected.region}
            </h2>
            <div className="flex items-center gap-3 text-xs">
              {running ? (
                <span className="text-orange-600">Measuring…</span>
              ) : (
                measuredAt && <span className="text-gray-400">Measured at {measuredAt}</span>
              )}
              <button
                onClick={() => runTest(selected)}
                disabled={running}
                className="bg-gray-100 px-3 py-1 font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
              >
                Retest
              </button>
            </div>
          </div>

          {/* Your Internet Speed — 3-column overview */}
          <SpeedPanel live={live} final={final} />

          {/* Network Quality Score — compact inline row */}
          <AimScore scores={final?.scores} />

          {/* main 2-column: Server Location (left) | Latency + Packet Loss (right) */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Section title="Server Location">
              <MapView lat={selected.lat} lon={selected.lon} label={selected.name}
                clientLat={meta?.lat} clientLon={meta?.lon} dark={dark} />
              <ConnectionInfo node={selected} meta={meta} />
            </Section>
            {(final ?? live) && <LatencySection snap={(final ?? live)!} />}
          </div>

          {/* Download / Upload tiers */}
          {(final ?? live) && <BandwidthSections snap={(final ?? live)!} />}
        </section>
      )}

      {!selected && nodes.length > 0 && (
        <p className="text-sm text-gray-400">Select an online node to start the test.</p>
      )}

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-400 dark:border-gray-800">
        NetQualityPanel · self-hosted link-quality panel · powered by the @cloudflare/speedtest engine
      </footer>
    </div>
  )
}
