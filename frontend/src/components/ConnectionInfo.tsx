import type { PublicNode, NodeMeta } from '../types'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}

// CF's "Server location / Your network / Your IP" panel. Server side = the node
// we're testing; client side = what the node observed about us (via /__meta).
export function ConnectionInfo({ node, meta }: { node: PublicNode; meta: NodeMeta | null }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <Row label="Server location" value={`${node.name} · ${node.region}`} />
      <Row label="Your IP address" value={meta?.ip ?? '…'} />
      <Row
        label="Your network"
        value={meta?.asn ? `AS${meta.asn}${meta.org ? ` · ${meta.org}` : ''}` : '…'}
      />
      {meta?.city && (
        <Row label="Your location" value={`${meta.city}${meta.country ? `, ${meta.country}` : ''}`} />
      )}
    </div>
  )
}
