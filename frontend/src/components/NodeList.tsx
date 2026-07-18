import type { PublicNode, NodeConn } from '../types'

const STATUS: Record<string, { dot: string; label: string }> = {
  checking: { dot: 'bg-gray-300 animate-pulse', label: 'Checking…' },
  online: { dot: 'bg-green-500', label: 'Online' },
  unreachable: { dot: 'bg-red-500', label: 'Unreachable' },
  authfail: { dot: 'bg-yellow-500', label: 'Auth failed' },
}

export function NodeList({
  nodes,
  conns,
  selectedId,
  onSelect,
  disabled,
}: {
  nodes: PublicNode[]
  conns: Record<string, NodeConn>
  selectedId: string | null
  onSelect: (n: PublicNode) => void
  disabled: boolean
}) {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <tr>
            <th className="px-3 py-2 font-medium">Node</th>
            <th className="px-3 py-2 font-medium">Region</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium text-right">Idle RTT</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => {
            const c = conns[n.id] ?? { status: 'checking' as const }
            const st = STATUS[c.status]
            const sel = n.id === selectedId
            return (
              <tr
                key={n.id}
                onClick={() => !disabled && onSelect(n)}
                className={
                  'cursor-pointer border-t border-gray-100 transition-colors dark:border-gray-800 ' +
                  (sel ? 'bg-orange-50 dark:bg-orange-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50') +
                  (disabled ? ' cursor-not-allowed opacity-60' : '')
                }
              >
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{n.name}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{n.region}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className={'h-2 w-2 rounded-full ' + st.dot} />
                    {st.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {c.rttMs != null ? `${c.rttMs} ms` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
