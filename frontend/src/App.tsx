import { useEffect, useRef, useState } from 'react'
import type SpeedTest from '@cloudflare/speedtest'
import type { PublicNode, NodeConn } from './types'
import { fetchNodes, fetchToken, ackNode } from './api'
import { startTest, type LiveSnapshot, type FinalResult } from './lib/speedtest'
import { NodeList } from './components/NodeList'
import { SpeedPanel } from './components/SpeedPanel'
import { Measurements } from './components/Measurements'

export default function App() {
  const [nodes, setNodes] = useState<PublicNode[]>([])
  const [conns, setConns] = useState<Record<string, NodeConn>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [live, setLive] = useState<LiveSnapshot | null>(null)
  const [final, setFinal] = useState<FinalResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  async function onSelect(n: PublicNode) {
    engineRef.current?.pause()
    setSelectedId(n.id)
    setLive(null)
    setFinal(null)
    setError(null)
    setRunning(true)
    try {
      const tok = await fetchToken(n.id)
      engineRef.current = startTest(tok.url, tok.token, {
        onProgress: setLive,
        onFinish: (r) => {
          setFinal(r)
          setRunning(false)
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
      <header className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">NetQualityPanel</h1>
        <p className="text-sm text-gray-500">测你的浏览器到自建 VPS 节点的链路质量</p>
      </header>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">节点</h2>
        <NodeList
          nodes={nodes}
          conns={conns}
          selectedId={selectedId}
          onSelect={onSelect}
          disabled={running}
        />
      </section>

      {selected && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {selected.name} · {selected.region}
            </h2>
            {running && <span className="text-xs text-orange-600">测量中…</span>}
          </div>
          <SpeedPanel live={live} final={final} running={running} />
          {(final ?? live) && (
            <div className="mt-6">
              <Measurements snap={(final ?? live)!} />
            </div>
          )}
        </section>
      )}

      {!selected && nodes.length > 0 && (
        <p className="text-sm text-gray-400">选一个在线节点开始测速。</p>
      )}
    </div>
  )
}
