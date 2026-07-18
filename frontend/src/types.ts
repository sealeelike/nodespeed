export interface PublicNode {
  id: string
  name: string
  url: string
  region: string
  lat: number
  lon: number
}

export interface TokenResp {
  node: string
  url: string
  token: string
  exp: number
}

// The client's own IP + geolocation, resolved by the browser from a free public
// geo API (see api.ts). Powers the "you are here" map pin and the connection panel.
export interface ClientGeo {
  ip: string
  asn?: number
  org?: string // network / ISP name
  lat?: number
  lon?: number
  city?: string
  country?: string
}

export type ConnStatus = 'checking' | 'online' | 'unreachable' | 'authfail'

export interface NodeConn {
  status: ConnStatus
  rttMs?: number
}
