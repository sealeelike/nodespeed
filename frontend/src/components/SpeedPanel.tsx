import type { LiveSnapshot, FinalResult } from '../lib/speedtest'
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
  streaming: '视频流',
  gaming: '在线游戏',
  rtc: '视频通话',
}

export function SpeedPanel({
  live,
  final,
  running,
}: {
  live: LiveSnapshot | null
  final: FinalResult | null
  running: boolean
}) {
  const snap = final ?? live
  const s = snap?.summary
  const down = snap?.downPoints ?? []
  const up = snap?.upPoints ?? []
  const scores = final?.scores

  return (
    <div className="space-y-6">
      {/* Your Internet Speed — 3 columns */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Download */}
        <div className="bg-gray-50 p-4 dark:bg-white/5">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Download</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-4xl font-bold" style={{ color: ORANGE }}>{mbps(s?.download)}</span>
            <span className="text-sm text-gray-500">Mbps</span>
          </div>
          <div className="mt-3"><LiveChart points={down} color={ORANGE} /></div>
        </div>

        {/* Upload */}
        <div className="bg-gray-50 p-4 dark:bg-white/5">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Upload</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-4xl font-bold" style={{ color: PURPLE }}>{mbps(s?.upload)}</span>
            <span className="text-sm text-gray-500">Mbps</span>
          </div>
          <div className="mt-3"><LiveChart points={up} color={PURPLE} /></div>
        </div>

        {/* Latency / Jitter */}
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

      {/* Network Quality Score (AIM) */}
      <div className="bg-gray-50 p-4 dark:bg-white/5">
        <div className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Network Quality Score</div>
        <div className="grid grid-cols-3 gap-4">
          {['streaming', 'gaming', 'rtc'].map((k) => {
            const sc = scores?.[k]
            const name = sc?.classificationName
            return (
              <div key={k} className="text-center">
                <div className="text-xs text-gray-500">{AIM_LABEL[k]}</div>
                <div className={'mt-1 text-lg font-bold capitalize ' + (name ? AIM_COLOR[name] : 'text-gray-300')}>
                  {name ?? '—'}
                </div>
              </div>
            )
          })}
        </div>
        {running && <div className="mt-3 text-center text-xs text-gray-400">测量中,评级测完给出…</div>}
      </div>
    </div>
  )
}
