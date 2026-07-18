import SpeedTest, {
  type Results,
  type MeasurementSummary,
  type Scores,
  type BandwidthPoint,
} from '@cloudflare/speedtest'

// The CF default measurement plan, minus the `packetLoss` step. Dropping it means
// zero Cloudflare dependency (the packetLoss step is the only thing that reaches
// out to CF's TURN-credentials endpoint). See spike/FINDINGS.md §4.
const MEASUREMENTS = [
  { type: 'latency', numPackets: 1 },
  { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 1e5, count: 9 },
  { type: 'download', bytes: 1e6, count: 8 },
  { type: 'upload', bytes: 1e5, count: 8 },
  { type: 'upload', bytes: 1e6, count: 6 },
  { type: 'download', bytes: 1e7, count: 6 },
  { type: 'upload', bytes: 1e7, count: 4 },
  { type: 'download', bytes: 25e6, count: 4 },
  { type: 'upload', bytes: 25e6, count: 4 },
  { type: 'download', bytes: 1e8, count: 3 },
  { type: 'upload', bytes: 5e7, count: 3 },
  { type: 'download', bytes: 25e7, count: 2 },
]

export interface LiveSnapshot {
  summary: MeasurementSummary
  downPoints: BandwidthPoint[]
  upPoints: BandwidthPoint[]
}

export interface FinalResult extends LiveSnapshot {
  scores: Scores
  unloadedLatencyPoints: number[]
  downLoadedLatencyPoints: number[]
  upLoadedLatencyPoints: number[]
}

function snapshot(res: Results): LiveSnapshot {
  return {
    summary: res.getSummary(),
    downPoints: res.getDownloadBandwidthPoints(),
    upPoints: res.getUploadBandwidthPoints(),
  }
}

export interface TestHandlers {
  onProgress?: (s: LiveSnapshot) => void
  onFinish?: (r: FinalResult) => void
  onError?: (msg: string) => void
}

// Token rides in the base URL query. The engine builds request URLs via
// `new URL(apiUrl)` + `searchParams.set('bytes', N)`, which preserves our token
// and just adds bytes/during — so `?token=…&bytes=…` comes out correct.
export function startTest(baseUrl: string, token: string, h: TestHandlers): SpeedTest {
  const q = `?token=${encodeURIComponent(token)}`
  const engine = new SpeedTest({
    autoStart: false,
    downloadApiUrl: `${baseUrl}/__down${q}`,
    uploadApiUrl: `${baseUrl}/__up${q}`,
    measurements: MEASUREMENTS as never,
  })
  engine.onResultsChange = () => h.onProgress?.(snapshot(engine.results))
  engine.onError = (msg: string) => h.onError?.(msg)
  engine.onFinish = (res: Results) => {
    h.onFinish?.({
      ...snapshot(res),
      scores: res.getScores(),
      unloadedLatencyPoints: res.getUnloadedLatencyPoints(),
      downLoadedLatencyPoints: res.getDownLoadedLatencyPoints(),
      upLoadedLatencyPoints: res.getUpLoadedLatencyPoints(),
    })
  }
  engine.play()
  return engine
}
