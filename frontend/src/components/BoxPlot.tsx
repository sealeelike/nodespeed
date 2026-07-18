import { useEffect, useRef, useState } from 'react'
import { computeStats, ticksUpTo } from '../lib/stats'

// CF-style horizontal box plot:
//   thick bar   = 25th–75th percentile
//   solid line  = median
//   dotted line = average
//   whiskers    = min / max
//   dots        = each individual measurement
// Axis carries several ticks + a unit label so tiers sharing one scale are
// visually comparable.
export function BoxPlot({
  values,
  axisMax,
  color,
  unit,
  tickFormat,
  height = 64,
}: {
  values: number[]
  axisMax: number
  color: string
  unit: string
  tickFormat: (v: number) => string
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const st = computeStats(values)
  const padL = 4
  const padR = 12
  const innerW = Math.max(1, w - padL - padR)
  const cy = 26
  const boxH = 16
  const axisY = height - 12
  const x = (v: number) => padL + (Math.min(Math.max(v, 0), axisMax) / (axisMax || 1)) * innerW
  const ticks = ticksUpTo(axisMax)

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={w} height={height} className="overflow-visible">
        {/* unit label */}
        <text x={padL} y={10} fontSize={11} fill="currentColor" className="text-gray-500 dark:text-gray-400">{unit}</text>

        {/* gridlines + tick labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={14} y2={axisY} stroke="currentColor" strokeWidth={1}
              className="text-gray-200 dark:text-gray-700" />
            <text x={x(t)} y={height - 1} fontSize={11} textAnchor="middle" fill="currentColor"
              className="text-gray-500 dark:text-gray-400">{tickFormat(t)}</text>
          </g>
        ))}

        {st && (
          <>
            <line x1={x(st.min)} x2={x(st.max)} y1={cy} y2={cy} stroke={color} strokeWidth={1} />
            <line x1={x(st.min)} x2={x(st.min)} y1={cy - 5} y2={cy + 5} stroke={color} strokeWidth={1} />
            <line x1={x(st.max)} x2={x(st.max)} y1={cy - 5} y2={cy + 5} stroke={color} strokeWidth={1} />
            <rect x={x(st.p25)} y={cy - boxH / 2} width={Math.max(1, x(st.p75) - x(st.p25))} height={boxH}
              fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1} />
            <line x1={x(st.avg)} x2={x(st.avg)} y1={cy - boxH / 2 - 3} y2={cy + boxH / 2 + 3}
              stroke={color} strokeWidth={1.5} strokeDasharray="2 2" />
            <line x1={x(st.median)} x2={x(st.median)} y1={cy - boxH / 2 - 3} y2={cy + boxH / 2 + 3}
              stroke={color} strokeWidth={2} />
            {values.map((v, i) => (
              <circle key={i} cx={x(v)} cy={cy} r={2.5} fill={color} fillOpacity={0.6} />
            ))}
          </>
        )}
      </svg>
    </div>
  )
}
