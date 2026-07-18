import type { LiveSnapshot, FinalResult } from '../lib/speedtest'
import type { Scores } from '@cloudflare/speedtest'
import { LiveChart } from './LiveChart'

const ORANGE = '#f6821f'
const PURPLE = '#9b59f6'

function mbps(bps?: number): string {
  if (!bps) return '—'
  return (bps / 1e6).toFixed(2)
}
function ms(v?: number): string {
  return v != null ? v.toFixed(1) : '—'
}

const AIM_COLOR: Record<string, string> = {
  bad: 'text-red-600',
  poor: 'text-orange-600',
  average: 'text-yellow-600',
  good: 'text-lime-600',
  great: 'text-green-600',
}
const AIM_LABEL: Record<string, string> = {
  streaming: 'Video Streaming',
  gaming: 'Online Gaming',
  rtc: 'Video Chatting',
}

// "Your Internet Speed" — the top 3-column overview (big numbers + live curves).
export function SpeedPanel({ live, final }: { live: LiveSnapshot | null; final: FinalResult | null }) {
  const snap = final ?? live
  const s = snap?.summary
  const down = snap?.downPoints ?? []
  const up = snap?.upPoints ?? []

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="bg-gray-50 p-4 dark:bg-white/5">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Download</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-4xl font-bold" style={{ color: ORANGE }}>{mbps(s?.download)}</span>
          <span className="text-sm text-gray-500">Mbps</span>
        </div>
        <div className="mt-3"><LiveChart points={down} color={ORANGE} /></div>
      </div>

      <div className="bg-gray-50 p-4 dark:bg-white/5">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Upload</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-4xl font-bold" style={{ color: PURPLE }}>{mbps(s?.upload)}</span>
          <span className="text-sm text-gray-500">Mbps</span>
        </div>
        <div className="mt-3"><LiveChart points={up} color={PURPLE} /></div>
      </div>

      <div className="bg-gray-50 p-4 dark:bg-white/5">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Latency / Jitter</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-gray-800 dark:text-gray-100">{ms(s?.latency)}</span>
          <span className="text-sm text-gray-500">ms</span>
        </div>
        <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <div>Jitter: <span className="tabular-nums">{ms(s?.jitter)}</span> ms</div>
          <div>↓ loaded: <span className="tabular-nums">{ms(s?.downLoadedLatency)}</span> ms</div>
          <div>↑ loaded: <span className="tabular-nums">{ms(s?.upLoadedLatency)}</span> ms</div>
        </div>
      </div>
    </div>
  )
}

// Network Quality Score — compact single inline row (like CF).
export function AimScore({ scores }: { scores: Scores | undefined }) {
  const keys = ['streaming', 'gaming', 'rtc']
  return (
    <div className="border-y border-gray-200 py-3 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm">
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
