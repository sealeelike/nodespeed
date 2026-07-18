export interface Stats {
  n: number
  min: number
  max: number
  avg: number
  median: number
  p25: number
  p75: number
}

// linear-interpolated percentile (matches the common "type 7" definition)
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN
  if (sortedAsc.length === 1) return sortedAsc[0]
  const idx = (p / 100) * (sortedAsc.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedAsc[lo]
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo)
}

export function computeStats(values: number[]): Stats | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const sum = s.reduce((a, b) => a + b, 0)
  return {
    n: s.length,
    min: s[0],
    max: s[s.length - 1],
    avg: sum / s.length,
    median: percentile(s, 50),
    p25: percentile(s, 25),
    p75: percentile(s, 75),
  }
}
