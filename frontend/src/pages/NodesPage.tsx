import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PublicNode, NodeConn } from '../types'
import { fetchNodes, ackNode, reloadNodes } from '../api'
import { NodeList } from '../components/NodeList'

// Overview page: lists all nodes with connectivity + idle RTT. Clicking a row
// navigates to /test. Refresh hot-reloads the central config, then re-acks.
export function NodesPage() {
  const [nodes, setNodes] = useState<PublicNode[]>([])
  const [conns, setConns] = useState<Record<string, NodeConn>>({})
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()

  // fetch the node list, seed every conn to "checking", then ack each in parallel
  async function loadAndAck() {
    const ns = await fetchNodes()
    setNodes(ns)
    setConns(Object.fromEntries(ns.map((n) => [n.id, { status: 'checking' as const }])))
    ns.forEach(async (n) => {
      const c = await ackNode(n.id)
      setConns((prev) => ({ ...prev, [n.id]: c }))
    })
  }

  useEffect(() => {
    loadAndAck().catch((e) => setError(String(e)))
  }, [])

  async function refresh() {
    setRefreshing(true)
    setError(null)
    try {
      await reloadNodes()
      await loadAndAck()
    } catch (e) {
      setError(String(e))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section>
      {error && (
        <div className="mb-4 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nodes</h2>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
          title="Reload config from disk and re-check nodes"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className={'h-3.5 w-3.5' + (refreshing ? ' animate-spin' : '')}>
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <NodeList
        nodes={nodes}
        conns={conns}
        selectedId={null}
        onSelect={(n) => navigate('/test?node=' + encodeURIComponent(n.id))}
        disabled={false}
      />

      {nodes.length === 0 && !error && (
        <p className="mt-4 text-sm text-gray-400">No nodes configured.</p>
      )}
    </section>
  )
}
