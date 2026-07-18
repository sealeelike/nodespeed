import type { PublicNode, TokenResp, NodeConn } from './types'

export async function fetchNodes(): Promise<PublicNode[]> {
  const r = await fetch('/api/nodes')
  if (!r.ok) throw new Error(`/api/nodes ${r.status}`)
  const j = await r.json()
  return j.nodes ?? []
}

export async function fetchToken(nodeId: string): Promise<TokenResp> {
  const r = await fetch(`/api/token?node=${encodeURIComponent(nodeId)}`)
  if (!r.ok) throw new Error(`/api/token ${r.status}`)
  return r.json()
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
