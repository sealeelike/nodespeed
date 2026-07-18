import type { PublicNode, ClientGeo } from '../types'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}

// CF's "Server location / Your network / Your IP" panel. Server side = the node
// we're testing; client side = the browser's own IP/geo from a public geo API.
export function ConnectionInfo({ node, geo }: { node: PublicNode; geo: ClientGeo | null }) {
  return (
    <div className="mt-4">
      <Row label="Server location" value={`${node.name} · ${node.region}`} />
      <Row label="Your IP address" value={geo?.ip ?? '…'} />
      <Row
        label="Your network"
        value={geo?.asn ? `AS${geo.asn}${geo.org ? ` · ${geo.org}` : ''}` : (geo?.org ?? '…')}
      />
      {geo?.city && (
        <Row label="Your location" value={`${geo.city}${geo.country ? `, ${geo.country}` : ''}`} />
      )}
    </div>
  )
}
