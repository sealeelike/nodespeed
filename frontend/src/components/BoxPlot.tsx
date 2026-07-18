import { useEffect, useRef, useState } from 'react'
import { computeStats } from '../lib/stats'

// CF-style horizontal box plot:
//   thick bar   = 25th–75th percentile
//   solid line  = median
//   dotted line = average
//   whiskers    = min / max
//   dots        = each individual measurement
export function BoxPlot({
  values,
  axisMax,
  axisMin = 0,
  color,
  format,
  height = 56,
}: {
  values: number[]
  axisMax: number
  axisMin?: number
  color: string
  format: (v: number) => string
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(300)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const st = computeStats(values)
  const padX = 8
  const innerW = Math.max(1, w - padX * 2)
  const cy = height / 2 - 6
  const boxH = 16
  const span = axisMax - axisMin || 1
  const x = (v: number) => padX + (Math.min(Math.max(v, axisMin), axisMax) - axisMin) / span * innerW

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={w} height={height} className="overflow-visible">
        {st && (
          <>
            {/* whisker line min→max */}
            <line x1={x(st.min)} x2={x(st.max)} y1={cy} y2={cy} stroke={color} strokeWidth={1} opacity={0.5} />
            <line x1={x(st.min)} x2={x(st.min)} y1={cy - 5} y2={cy + 5} stroke={color} strokeWidth={1} opacity={0.5} />
            <line x1={x(st.max)} x2={x(st.max)} y1={cy - 5} y2={cy + 5} stroke={color} strokeWidth={1} opacity={0.5} />
            {/* 25–75 box */}
            <rect x={x(st.p25)} y={cy - boxH / 2} width={Math.max(1, x(st.p75) - x(st.p25))} height={boxH}
              fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1} rx={2} />
            {/* average (dotted) */}
            <line x1={x(st.avg)} x2={x(st.avg)} y1={cy - boxH / 2 - 3} y2={cy + boxH / 2 + 3}
              stroke={color} strokeWidth={1.5} strokeDasharray="2 2" opacity={0.8} />
            {/* median (solid) */}
            <line x1={x(st.median)} x2={x(st.median)} y1={cy - boxH / 2 - 3} y2={cy + boxH / 2 + 3}
              stroke={color} strokeWidth={2} />
            {/* individual points */}
            {values.map((v, i) => (
              <circle key={i} cx={x(v)} cy={cy} r={2.5} fill={color} fillOpacity={0.55} />
            ))}
          </>
        )}
        {/* axis labels */}
        <text x={padX} y={height - 2} fontSize={10} fill="#9ca3af">{format(axisMin)}</text>
        <text x={w - padX} y={height - 2} fontSize={10} fill="#9ca3af" textAnchor="end">{format(axisMax)}</text>
      </svg>
    </div>
  )
}
