import type { PublicNode, TokenResp, NodeConn, ClientGeo } from './types'

export async function fetchNodes(): Promise<PublicNode[]> {
  const r = await fetch('/api/nodes')
  if (!r.ok) throw new Error(`/api/nodes ${r.status}`)
  const j = await r.json()
  return j.nodes ?? []
}

// hot-reload the central's node config from disk (re-reads file + GeoIP fill)
export async function reloadNodes(): Promise<void> {
  const r = await fetch('/api/reload', { method: 'POST' })
  if (!r.ok) throw new Error(`/api/reload ${r.status}`)
}

export async function fetchToken(nodeId: string): Promise<TokenResp> {
  const r = await fetch(`/api/token?node=${encodeURIComponent(nodeId)}`)
  if (!r.ok) throw new Error(`/api/token ${r.status}`)
  return r.json()
}

// The client's own IP + geolocation, for the "you are here" pin and connection
// panel. The browser asks a free geo API about ITSELF — its public egress IP is
// exactly "where you are", so no node/central involvement and no GeoIP DB to ship.
// ipinfo.io first (https + CORS, no key, reliably reachable from mainland China);
// ipwho.is as a fallback when ipinfo is rate-limited or blocked.
export async function fetchClientGeo(): Promise<ClientGeo> {
  try {
    return await fromIpinfo()
  } catch {
    return await fromIpwhois()
  }
}

async function fromIpinfo(): Promise<ClientGeo> {
  const r = await fetch('https://ipinfo.io/json', { cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`ipinfo ${r.status}`)
  const j = await r.json()
  const [lat, lon] = String(j.loc ?? '').split(',').map(Number)
  const m = /^AS(\d+)\s+(.*)$/.exec(j.org ?? '') // "AS15169 Google LLC" -> [_, "15169", "Google LLC"]
  return {
    ip: j.ip,
    asn: m ? Number(m[1]) : undefined,
    org: m ? m[2] : (j.org || undefined),
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
    city: j.city || undefined,
    country: j.country || undefined,
  }
}

async function fromIpwhois(): Promise<ClientGeo> {
  const r = await fetch('https://ipwho.is/', { cache: 'no-store' })
  if (!r.ok) throw new Error(`ipwho.is ${r.status}`)
  const j = await r.json()
  if (j.success === false) throw new Error(`ipwho.is: ${j.message ?? 'lookup failed'}`)
  return {
    ip: j.ip,
    asn: j.connection?.asn,
    org: j.connection?.isp || j.connection?.org,
    lat: j.latitude,
    lon: j.longitude,
    city: j.city,
    country: j.country_code,
  }
}

// ack handshake: get a token, hit the node's /__ack, and classify the result.
// 200 -> online (with RTT); 403 -> auth failed; anything else/throw -> unreachable.
export async function ackNode(nodeId: string): Promise<NodeConn> {
  let tok: TokenResp
  try {
    tok = await fetchToken(nodeId)
  } catch {
    return { status: 'unreachable' }
  }
  const url = `${tok.url}/__ack?token=${encodeURIComponent(tok.token)}`
  const t0 = performance.now()
  try {
    const r = await fetch(url, { cache: 'no-store' })
    const rttMs = Math.round(performance.now() - t0)
    if (r.status === 403) return { status: 'authfail' }
    if (!r.ok) return { status: 'unreachable' }
    return { status: 'online', rttMs }
  } catch {
    return { status: 'unreachable' }
  }
}
