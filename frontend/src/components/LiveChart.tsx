import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { BandwidthPoint } from '@cloudflare/speedtest'

// A compact area chart of bandwidth points (Mbps over elapsed seconds).
// download = orange, upload = purple (the project's color rule).
export function LiveChart({
  points,
  color,
  height = 110,
}: {
  points: BandwidthPoint[]
  color: string
  height?: number
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  // build [x[], y[]] from points: x = seconds since first sample, y = Mbps
  const t0 = points.length ? new Date(points[0].measTime).getTime() : 0
  const xs = points.map((p) => (new Date(p.measTime).getTime() - t0) / 1000)
  const ys = points.map((p) => p.bps / 1e6)

  // 90th-percentile reference line (CF shows this on its speed curves)
  const p90 = (() => {
    if (ys.length < 2) return null
    const s = [...ys].sort((a, b) => a - b)
    return s[Math.min(s.length - 1, Math.floor(0.9 * (s.length - 1)))]
  })()
  const p90Ref = useRef<number | null>(p90)
  p90Ref.current = p90

  useEffect(() => {
    if (!elRef.current) return
    const opts: uPlot.Options = {
      width: elRef.current.clientWidth || 300,
      height,
      cursor: { show: false },
      legend: { show: false },
      scales: { x: { time: false } },
      hooks: {
        draw: [
          (u) => {
            const v = p90Ref.current
            if (v == null) return
            const y = Math.round(u.valToPos(v, 'y', true)) + 0.5
            const { left, width } = u.bbox
            const ctx = u.ctx
            ctx.save()
            ctx.strokeStyle = '#9ca3af'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 3])
            ctx.beginPath()
            ctx.moveTo(left, y)
            ctx.lineTo(left + width, y)
            ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = '#9ca3af'
            ctx.font = '10px system-ui'
            ctx.textBaseline = 'bottom'
            ctx.fillText('90th percentile', left + 4, y - 2)
            ctx.restore()
          },
        ],
      },
      // no visible axes — clean full-bleed sparkline like CF (y-scale still
      // drives valToPos for the 90th-percentile reference line)
      axes: [
        { show: false },
        { show: false },
      ],
      series: [
        {},
        {
          stroke: color,
          width: 2,
          fill: color + '22',
          points: { show: true, size: 4, stroke: color, fill: color },
        },
      ],
    }
    const plot = new uPlot(opts, [xs, ys], elRef.current)
    plotRef.current = plot
    // track the container's own width (grid columns reflow without a window
    // resize) so the canvas never overflows and forces horizontal scroll
    const ro = new ResizeObserver(() => {
      const width = elRef.current?.clientWidth
      if (width) plot.setSize({ width, height })
    })
    ro.observe(elRef.current)
    return () => {
      ro.disconnect()
      plot.destroy()
      plotRef.current = null
    }
    // rebuild only when color/height change; data updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, height])

  useEffect(() => {
    plotRef.current?.setData([xs, ys])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  return <div ref={elRef} style={{ width: '100%', height }} />
}
