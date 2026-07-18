# NodeSpeed 构建顺序（ROADMAP）

> 原则：**先验证最大假设 → 打通最细端到端竖切 → 再加厚 → 最后抛光**。
> 核心赌注：CF 引擎 `@cloudflare/speedtest` 指向自建端点能跑出正确曲线 + AIM。未验证前，UI/鉴权/部署都是空中楼阁。
> 配套：设计见 [PRODUCT_SPEC.md](PRODUCT_SPEC.md)，功能清单见 [FEATURES.md](FEATURES.md)。最后更新 2026-07-18。

---

## 阶段 0：验证核心赌注（最先，可抛弃 spike）
- 极简 Go agent：`/__down?bytes=N`、`/__up`、`/__ack`，带 `Server-Timing`，CORS 全开；先 HTTP、localhost、**无 TLS 无令牌**。
- 几十行 HTML：引入 `@cloudflare/speedtest`，`downloadApiUrl`/`uploadApiUrl` 指向该 agent，打印 `getSummary()`。
- **必须确认**：
  1. 引擎认自建端点、跑得出数
  2. `Server-Timing` 被正确扣除、延迟准
  3. AIM 评分出得来，**且结果对象含画箱线图所需的逐次原始数据 + 百分位 + 加载延迟**
- 顺带定：回传 CF 那段 fork 不 fork。
- ⚠ 此步失败则"复用引擎"方案要重想 —— 必须第一个做、且便宜。

## 阶段 1：最细端到端竖切（打通全链路）
目标：一个真实节点 + 中心签令牌 + 前端能测出结果（最小集）。
- Agent 加：HMAC 令牌校验、TLS、systemd。
- 中心（Go）：登录 + 节点配置 + 令牌签发 + 发静态前端。
- 前端：只做 **节点列表 + 顶部三列（大数字 + 实时曲线）+ AIM 三评级**；箱线图/地图/历史先不做。
- 完成即验证：鉴权 + 测量 + 展示整条链路。

## 阶段 2：前端加厚到 CF 保真度
- 箱线图卡（延迟测量 + 分档下载/上传）+ 展开明细表 + 统计气泡
- Server Location 连接信息 + 地图（MapLibre）
- 深色模式、控制条、footer
- 花时间最多的一段。可先出静态假数据原型锁视觉，再接真引擎。

## 阶段 3：部署工程化（→ 可用 MVP）
- 一键交互脚本打磨（问子域名/节点名/地区、生成 secret、装服务）
- 中心 Docker 化（Go 二进制 + 内嵌前端包，单容器）
- 文档、跑通 10+ 节点

## 阶段 4：加分功能（二期）
- 多节点地图标注 + 弧线
- 多节点并排对比
- 历史趋势（SQLite）
- 手机响应式

## 阶段 5：丢包（三期，可选）
- 每节点 coturn + 引擎 packetLoss 配置

---

## 关键判断
- 阶段 0→1 别跳步：先搭漂亮 UI 容易撞上"引擎某数据拿不到"而返工。
- 前端在阶段 2 才追求像素级；阶段 1 丑没关系，先要"通"。
- Agent 与前端理论可并行（前端可先对无鉴权的阶段 0 agent 开发），但单人做顺序推更省脑子。

## 当前进度 / 下一步
- **阶段 0 spike 通过 ✅**(2026-07-18)：引擎契约验证,详见 [spike/FINDINGS.md](spike/FINDINGS.md)。不用 fork,去掉 packetLoss 即零 CF 依赖。
- **阶段 1 端到端竖切 完成并验证通过 ✅**(2026-07-18)。全链路跑通:中心签令牌 → 前端 → 节点 agent(HMAC 验签)→ 测量 → 实时 UI + AIM。
  - `node-agent/`:/__ack /__down /__up,HMAC 令牌门禁(过期/伪造 403)、TLS 多模式(cert/selfsign/http)、Server-Timing。真域名证书 8443 验证。
  - `central/`:无登录;`GET /api/nodes`(剔 secret)、`GET /api/token?node=`(签令牌)、发静态前端。令牌算法与 agent 一致。
  - `frontend/`:Vite+React+Tailwind;节点表+连通性(ack)、三列(下行橙/上行紫大数字+uPlot 实时曲线+加载延迟)、AIM 三评级。
  - 分支 `feat/phase1-vertical-slice`,4 个提交。测试机上 `nodespeed-agent`(systemd transient)跑在 :8443。
- **阶段 2 前端保真度 完成并验证通过 ✅**(2026-07-18,已合 main)。
  - 箱线图(BoxPlot.tsx,粗条/中位/均值/须/散点)复用于 A4 延迟三卡 + A6/A7 分档下载上传;展开出统计气泡 + 逐次明细表(#/Duration/Speed)。
  - A3:MapLibre + CARTO Positron/Dark 灰度地图(免 key)+ 节点图钉;连接信息(Your IP + AS/ISP,来自节点新增 `/__meta` + 内置 DB-IP ASN mmdb)。
  - 控制条(Retest + Measured at)、header/footer、A10 深色模式(class 版 + 持久化 + 地图同步换肤)。全部浏览器验证。
- **下一步**:进入**阶段 3**(部署工程化 → 可用 MVP)——一键交互脚本(问子域名/节点名/地区/TLS 模式,内置 acme.sh 申请模块,生成 secret,装正式 systemd unit)、中心 Docker 化(Go 二进制 + 内嵌前端 dist,单容器)、跑通 10+ 节点。
  - 收尾项(小):`nodespeed-agent` 现在是 transient unit,阶段 3 落成正式 unit 文件;GeoIP mmdb 随脚本下载/续期。
