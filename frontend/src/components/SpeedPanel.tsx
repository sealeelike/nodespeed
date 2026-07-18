import type { LiveSnapshot, FinalResult } from '../lib/speedtest'
import type { Scores } from '@cloudflare/speedtest'
import { LiveChart } from './LiveChart'

const ORANGE = '#f6821f'
const PURPLE = '#9b59f6'

function mbps(bps?: number): string {
  if (!bps) return '—'
  return (bps / 1e6).toFixed(1)
}
function ms(v?: number): string {
  return v != null ? v.toFixed(1) : '—'
}

// deliberately muted — no rainbow. bad/poor warm, average neutral, good/great green.
const AIM_COLOR: Record<string, string> = {
  bad: 'text-red-600 dark:text-red-400',
  poor: 'text-orange-600 dark:text-orange-400',
  average: 'text-gray-700 dark:text-gray-300',
  good: 'text-green-600 dark:text-green-400',
  great: 'text-green-700 dark:text-green-400',
}
const AIM_LABEL: Record<string, string> = {
  streaming: 'Video Streaming',
  gaming: 'Online Gaming',
  rtc: 'Video Chatting',
}

// column heading — small, uppercased, no color
function Label({ children }: { children: string }) {
  return <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{children}</div>
}

// big black metric number + unit (CF style — color lives only in the chart)
function Metric({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="mt-1 flex items-baseline gap-1.5">
      <span className="font-mono text-4xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-gray-50">
        {value}
      </span>
      <span className="text-base text-gray-500">{unit}</span>
    </div>
  )
}

// "Your Internet Speed" — top overview: Download | Upload | Latency·Jitter·Packet Loss.
export function SpeedPanel({ live, final }: { live: LiveSnapshot | null; final: FinalResult | null }) {
  const snap = final ?? live
  const s = snap?.summary
  const down = snap?.downPoints ?? []
  const up = snap?.upPoints ?? []

  return (
    <div>
      <h2 className="mb-4 text-base font-bold text-gray-900 dark:text-gray-100">Your Internet Speed</h2>
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        {/* Download */}
        <div className="min-w-0">
          <Label>Download</Label>
          <Metric value={mbps(s?.download)} unit="Mbps" />
          <div className="mt-3"><LiveChart points={down} color={ORANGE} /></div>
        </div>

        {/* Upload */}
        <div className="min-w-0">
          <Label>Upload</Label>
          <Metric value={mbps(s?.upload)} unit="Mbps" />
          <div className="mt-3"><LiveChart points={up} color={PURPLE} /></div>
        </div>

        {/* Latency / Jitter / Packet Loss — stacked text metrics */}
        <div className="space-y-4 md:min-w-40">
          <div>
            <Label>Latency</Label>
            <Metric value={ms(s?.latency)} unit="ms" />
            <div className="mt-1 flex gap-4 text-sm tabular-nums text-gray-600 dark:text-gray-400">
              <span><span style={{ color: ORANGE }}>↓</span> {ms(s?.downLoadedLatency)} ms</span>
              <span><span style={{ color: PURPLE }}>↑</span> {ms(s?.upLoadedLatency)} ms</span>
            </div>
          </div>
          <div>
            <Label>Jitter</Label>
            <Metric value={ms(s?.jitter)} unit="ms" />
          </div>
          <div>
            <Label>Packet Loss</Label>
            <div className="mt-1 text-2xl font-bold text-gray-400">—</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Network Quality Score — compact single inline row (like CF).
export function AimScore({ scores }: { scores: Scores | undefined }) {
  const keys = ['streaming', 'gaming', 'rtc']
  return (
    <div>
      <h2 className="mb-3 text-base font-bold text-gray-900 dark:text-gray-100">Network Quality Score</h2>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 border-y border-gray-200 py-3 text-sm dark:border-gray-800">
        {keys.map((k) => {
          const name = scores?.[k]?.classificationName
          return (
            <span key={k} className="text-gray-600 dark:text-gray-400">
              {AIM_LABEL[k]}:{' '}
              <span className={'font-semibold capitalize ' + (name ? AIM_COLOR[name] : 'text-gray-300')}>
                {name ?? '—'}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
