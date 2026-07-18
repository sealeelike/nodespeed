import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { BandwidthPoint } from '@cloudflare/speedtest'

// A compact area chart of bandwidth points (Mbps over elapsed seconds).
// download = orange, upload = purple (the project's color rule).
export function LiveChart({
  points,
  color,
  height = 90,
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

  useEffect(() => {
    if (!elRef.current) return
    const opts: uPlot.Options = {
      width: elRef.current.clientWidth || 300,
      height,
      cursor: { show: false },
      legend: { show: false },
      scales: { x: { time: false } },
      axes: [
        { show: false },
        { size: 34, grid: { show: true, stroke: '#eee' }, ticks: { show: false },
          font: '10px system-ui', stroke: '#999' },
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
    const onResize = () => plot.setSize({ width: elRef.current!.clientWidth, height })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
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
