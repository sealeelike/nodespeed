import { useState } from 'react'
import { BoxPlot } from './BoxPlot'
import { computeStats } from '../lib/stats'

export function niceCeil(v: number): number {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / mag
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * mag
}

// One measurement block: title + count, a box plot, and an expandable detail
// table with a stats summary. Used for latency (A4) and bandwidth tiers (A6/A7).
export function MeasurementCard({
  title,
  values,
  color,
  format,
  columns,
  rows,
  axisMax,
}: {
  title: string
  values: number[]
  color: string
  format: (v: number) => string
  columns: string[]
  rows: string[][]
  axisMax?: number
}) {
  const [open, setOpen] = useState(false)
  const st = computeStats(values)
  const max = axisMax ?? niceCeil((st?.max ?? 1) * 1.05)

  return (
    <div className="border-b border-gray-100 py-2 last:border-0 dark:border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {title} {st && <span className="text-gray-400">({st.n})</span>}
        </span>
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
      </button>

      <BoxPlot values={values} axisMax={max} color={color} format={format} />

      {open && st && (
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-md bg-gray-50 p-2 text-xs sm:grid-cols-6 dark:bg-gray-800/50">
            <Stat label="Min" v={format(st.min)} />
            <Stat label="Max" v={format(st.max)} />
            <Stat label="Average" v={format(st.avg)} />
            <Stat label="Median" v={format(st.median)} />
            <Stat label="25th" v={format(st.p25)} />
            <Stat label="75th" v={format(st.p75)} />
          </div>
          <table className="w-full text-xs">
            <thead className="text-left text-gray-400">
              <tr>{columns.map((c) => <th key={c} className="py-1 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody className="tabular-nums text-gray-600 dark:text-gray-400">
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                  {r.map((cell, j) => <td key={j} className="py-1">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-gray-400">{label}</div>
      <div className="font-medium text-gray-700 dark:text-gray-300">{v}</div>
    </div>
  )
}

export function BoxPlotLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
      <span>粗条 = 25–75 百分位</span>
      <span>实线 = 中位数</span>
      <span>虚线 = 平均值</span>
      <span>须 = min/max</span>
      <span>散点 = 每次测量</span>
    </div>
  )
}
