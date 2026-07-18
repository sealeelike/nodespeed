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

export interface NodeMeta {
  ip: string
  asn?: number
  org?: string
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
