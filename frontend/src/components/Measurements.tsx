import type { ReactNode } from 'react'
import type { BandwidthPoint } from '@cloudflare/speedtest'
import type { LiveSnapshot } from '../lib/speedtest'
import { MeasurementCard, BoxPlotLegend } from './MeasurementCard'
import { niceCeil } from '../lib/stats'

const ORANGE = '#f6821f'
const PURPLE = '#9b59f6'
const GRAY = '#64748b'

const fmtMsStat = (v: number) => `${v.toFixed(1)} ms`
const fmtMbpsStat = (v: number) => `${v.toFixed(2)} Mbps`
const tickMs = (v: number) => `${v}`
const tickBps = (v: number) => (v === 0 ? '0' : `${v}M`)

function tierLabel(bytes: number): string {
  if (bytes >= 1e6) return `${bytes / 1e6} MB`
  return `${bytes / 1e3} kB`
}

function byTier(points: BandwidthPoint[]): { bytes: number; pts: BandwidthPoint[] }[] {
  const m = new Map<number, BandwidthPoint[]>()
  for (const p of points) {
    const arr = m.get(p.bytes) ?? []
    arr.push(p)
    m.set(p.bytes, arr)
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([bytes, pts]) => ({ bytes, pts }))
}

const bwRows = (pts: BandwidthPoint[]): string[][] =>
  pts.map((p, i) => [`${i + 1}`, `${p.duration.toFixed(0)} ms`, `${(p.bps / 1e6).toFixed(2)} Mbps`])
const latRows = (vals: number[]): string[][] => vals.map((v, i) => [`${i + 1}`, `${v.toFixed(1)} ms`])

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-700 dark:border-gray-800/60 dark:text-gray-300">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function Measurements({ snap }: { snap: LiveSnapshot }) {
  const downTiers = byTier(snap.downPoints)
  const upTiers = byTier(snap.upPoints)

  // shared axis per direction so tiers are comparable (like CF)
  const downMax = niceCeil(Math.max(0.001, ...snap.downPoints.map((p) => p.bps / 1e6)))
  const upMax = niceCeil(Math.max(0.001, ...snap.upPoints.map((p) => p.bps / 1e6)))
  const latMax = 800

  return (
    <div className="space-y-6">
      <Section title="Latency Measurements">
        <MeasurementCard title="Unloaded latency" values={snap.unloadedLatencyPoints} color={GRAY}
          format={fmtMsStat} unit="ms" tickFormat={tickMs} axisMax={latMax} columns={['#', 'Latency']} rows={latRows(snap.unloadedLatencyPoints)} />
        <MeasurementCard title="Latency during download" values={snap.downLoadedLatencyPoints} color={ORANGE}
          format={fmtMsStat} unit="ms" tickFormat={tickMs} axisMax={latMax} columns={['#', 'Latency']} rows={latRows(snap.downLoadedLatencyPoints)} />
        <MeasurementCard title="Latency during upload" values={snap.upLoadedLatencyPoints} color={PURPLE}
          format={fmtMsStat} unit="ms" tickFormat={tickMs} axisMax={latMax} columns={['#', 'Latency']} rows={latRows(snap.upLoadedLatencyPoints)} />
      </Section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Download Measurements">
          {downTiers.map(({ bytes, pts }) => (
            <MeasurementCard key={bytes} title={`${tierLabel(bytes)} download`} values={pts.map((p) => p.bps / 1e6)}
              color={ORANGE} format={fmtMbpsStat} unit="bps" tickFormat={tickBps} axisMax={downMax}
              columns={['#', 'Duration', 'Speed']} rows={bwRows(pts)} />
          ))}
        </Section>
        <Section title="Upload Measurements">
          {upTiers.map(({ bytes, pts }) => (
            <MeasurementCard key={bytes} title={`${tierLabel(bytes)} upload`} values={pts.map((p) => p.bps / 1e6)}
              color={PURPLE} format={fmtMbpsStat} unit="bps" tickFormat={tickBps} axisMax={upMax}
              columns={['#', 'Duration', 'Speed']} rows={bwRows(pts)} />
          ))}
        </Section>
      </div>

      <BoxPlotLegend />
    </div>
  )
}
