import type { ReactNode } from 'react'
import type { BandwidthPoint } from '@cloudflare/speedtest'
import type { LiveSnapshot } from '../lib/speedtest'
import { MeasurementCard, BoxPlotLegend } from './MeasurementCard'

const ORANGE = '#f6821f'
const PURPLE = '#9b59f6'
const GRAY = '#64748b'

const fmtMs = (v: number) => `${v.toFixed(0)} ms`
const fmtMbps = (v: number) => `${v.toFixed(1)}`

function tierLabel(bytes: number): string {
  if (bytes >= 1e6) return `${bytes / 1e6} MB`
  return `${bytes / 1e3} kB`
}

// group bandwidth points by their originating payload size, preserving tier order
function byTier(points: BandwidthPoint[]): { bytes: number; pts: BandwidthPoint[] }[] {
  const m = new Map<number, BandwidthPoint[]>()
  for (const p of points) {
    const arr = m.get(p.bytes) ?? []
    arr.push(p)
    m.set(p.bytes, arr)
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([bytes, pts]) => ({ bytes, pts }))
}

function bwRows(pts: BandwidthPoint[]): string[][] {
  return pts.map((p, i) => [`${i + 1}`, `${p.duration.toFixed(0)} ms`, `${(p.bps / 1e6).toFixed(2)} Mbps`])
}
function latRows(vals: number[]): string[][] {
  return vals.map((v, i) => [`${i + 1}`, `${v.toFixed(1)} ms`])
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export function Measurements({ snap }: { snap: LiveSnapshot }) {
  const downTiers = byTier(snap.downPoints)
  const upTiers = byTier(snap.upPoints)
  const latMax = 800

  return (
    <div className="space-y-4">
      <Section title="Latency Measurements">
        <MeasurementCard title="Unloaded latency" values={snap.unloadedLatencyPoints}
          color={GRAY} format={fmtMs} axisMax={latMax} columns={['#', 'Latency']} rows={latRows(snap.unloadedLatencyPoints)} />
        <MeasurementCard title="Latency during download" values={snap.downLoadedLatencyPoints}
          color={ORANGE} format={fmtMs} axisMax={latMax} columns={['#', 'Latency']} rows={latRows(snap.downLoadedLatencyPoints)} />
        <MeasurementCard title="Latency during upload" values={snap.upLoadedLatencyPoints}
          color={PURPLE} format={fmtMs} axisMax={latMax} columns={['#', 'Latency']} rows={latRows(snap.upLoadedLatencyPoints)} />
      </Section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="Download Measurements">
          {downTiers.map(({ bytes, pts }) => (
            <MeasurementCard key={bytes} title={`${tierLabel(bytes)} download`}
              values={pts.map((p) => p.bps / 1e6)} color={ORANGE} format={fmtMbps}
              columns={['#', 'Duration', 'Speed']} rows={bwRows(pts)} />
          ))}
        </Section>
        <Section title="Upload Measurements">
          {upTiers.map(({ bytes, pts }) => (
            <MeasurementCard key={bytes} title={`${tierLabel(bytes)} upload`}
              values={pts.map((p) => p.bps / 1e6)} color={PURPLE} format={fmtMbps}
              columns={['#', 'Duration', 'Speed']} rows={bwRows(pts)} />
          ))}
        </Section>
      </div>

      <BoxPlotLegend />
    </div>
  )
}
