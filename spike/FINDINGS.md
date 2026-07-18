# 阶段 0 Spike 结论(2026-07-18)

> 验证机:HK VPS `154.94.236.99`(Debian 12 / amd64 / systemd 252,代理机,443/57680 已占)。
> 方法:本机交叉编译极简 Go agent(同源托管测试页 + `/__down` `/__up` `/__ack` `/__result`,HTTP :8080),
> 真浏览器打开 `http://154.94.236.99:8080/` 自动跑 `@cloudflare/speedtest`(esm.sh 最新),结果 POST 回落盘。
> 代码见本目录 `agent.go` / `index.html`;原始结果 `results/latest.json`。

## 结论:✅ 核心赌注成立,可以按原方案继续。CF 引擎能驱动自建端点,且吐出复刻 CF 全部页面所需的数据。

---

## 1. 引擎 API(实测)
- import:`(await import('https://esm.sh/@cloudflare/speedtest')).default` 是构造函数。
- 构造:`new SpeedTest({ autoStart, downloadApiUrl, uploadApiUrl, measurements? })`。
- 回调:`onRunningChange(bool)` / `onResultsChange(ev)` / `onError(err)` / `onFinish(results)`。
  - `onFinish` **可靠**:即便中途报错(丢包)也会触发。
- 结果对象方法(全部实测存在):
  - `getSummary()` → `{download, upload, latency, jitter, downLoadedLatency, downLoadedJitter, upLoadedLatency, upLoadedJitter, totalDurationMs}`(bps / ms)。
  - `getScores()` → AIM:`{streaming, gaming, rtc}`,每个 `{points, classificationIdx, classificationName}`(bad/poor/average/good/great)。
  - **逐次原始点(箱线图命根子)**:
    - `getUnloadedLatencyPoints()` / `getDownLoadedLatencyPoints()` / `getUpLoadedLatencyPoints()` → `number[]`(各 20 个 ms 样本)。
    - `getDownloadBandwidthPoints()` / `getUploadBandwidthPoints()` → 富对象数组:
      `{bytes, bps, duration, ping, measTime, serverTime, transferSize}`。
  - `getPacketLossDetails()` → 失败时 `{error:'unable to get turn server credentials'}`(可检测→显示"不可用")。
  - 其它:`getDownloadBandwidth/getUploadBandwidth/getUnloadedLatency/...`、`getTotalDurationMs`、`isFinished`、`clear`。`raw` 属性取到是 null(用不上)。

## 2. 请求契约(节点 agent 必须实现的)
- 下载:`GET {downloadApiUrl}?bytes=N` → 返回 N 字节。加载延迟探测用 `GET .../__down?during=upload&bytes=0`(**必须支持 bytes=0**)。
- 上传:`POST {uploadApiUrl}?bytes=N` → body 为 N 字节,agent 收完丢弃即可。
- `Server-Timing: cfRequestDuration;dur=<ms>` **被引擎解析**:下载点 `serverTime` 精确等于 agent 发的 dur(实测 0.004–0.025ms)。→ 节点务必发这个头。
- 失败重试:引擎对每个请求重试 ~20 次才 `onError` 放弃。
- CORS:跨域可用(agent 发 `Access-Control-Allow-Origin:*`);同源更省事。`Timing-Allow-Origin:*` 让跨域也能读 Server-Timing。

## 3. 分档箱线图可还原(A6/A7)
按 `bytes` 分组带宽点即得 CF 的分档卡,计数与 CF 默认一致:
- 下载:100kB × 10、1MB × 8、10MB × 6
- 上传:100kB × 8、1MB × 6、10MB × 4
每档 median/min/max/p25/p75 自行计算。延迟三档同理(各 20 点)。

## 4. fork 问题:**不用 fork 源码,配置即可零 CF 依赖**
- 唯一碰 CF 的是**丢包**步:引擎默认去 CF 的 `turnServerCredsApiUrl` 要 TURN 凭证 → 失败。
- 未见任何结果回传 CF 的遥测报错(测量本身在本地算,上报是 speed.cloudflare.com 应用层的事,库不做)。
- **做法**:传自定义 `measurements` 去掉 `packetLoss` 步(v1 本就不做丢包),即全程零 CF 触达。三期加丢包时改指向自建 coturn。
- → 直接用 npm 包即可,省掉维护 fork 的成本。(Phase 1 再核一遍源码确认无隐藏上报。)

## 5. 本次真实测得(HK 节点,仅供参考)
下 17.6M / 上 16.0M / 空载延迟 289ms / 抖动 3.5ms;AIM:streaming=average、gaming=poor、rtc=average。

## 遗留
- perfEntries(我在页面里额外抓的 PerformanceResourceTiming)为空——是我采样时机在 resource buffer 溢出后,非引擎问题;引擎内部的 `serverTime` 已证明 Server-Timing 生效,此项不影响。
- spike agent 以 transient systemd unit `netqual-spike` 跑在节点 :8080,重启即消失;不用了可 `systemctl stop netqual-spike`。
