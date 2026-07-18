import { useEffect, useRef, useState } from 'react'
import type SpeedTest from '@cloudflare/speedtest'
import type { PublicNode, NodeConn, NodeMeta } from './types'
import { fetchNodes, fetchToken, fetchMeta, ackNode } from './api'
import { startTest, type LiveSnapshot, type FinalResult } from './lib/speedtest'
import { NodeList } from './components/NodeList'
import { SpeedPanel } from './components/SpeedPanel'
import { Measurements } from './components/Measurements'
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">NetQualityPanel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">测你的浏览器到自建 VPS 节点的链路质量</p>
        </div>
        <button
          onClick={toggleDark}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          title="切换深色模式"
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">节点</h2>
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
                <span className="text-orange-600">测量中…</span>
              ) : (
                measuredAt && <span className="text-gray-400">Measured at {measuredAt}</span>
              )}
              <button
                onClick={() => runTest(selected)}
                disabled={running}
                className="rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Retest
              </button>
            </div>
          </div>

          <SpeedPanel live={live} final={final} running={running} />

          {/* Server Location: map + connection info */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <MapView lat={selected.lat} lon={selected.lon} label={selected.name}
              clientLat={meta?.lat} clientLon={meta?.lon} dark={dark} />
            <ConnectionInfo node={selected} meta={meta} />
          </div>

          {(final ?? live) && <Measurements snap={(final ?? live)!} />}
        </section>
      )}

      {!selected && nodes.length > 0 && (
        <p className="text-sm text-gray-400">选一个在线节点开始测速。</p>
      )}

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-400 dark:border-gray-800">
        NetQualityPanel · 自建链路质量面板 · 复用 @cloudflare/speedtest 引擎
      </footer>
    </div>
  )
}
