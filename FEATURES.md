# NodeSpeed 功能清单（权威）

> 页面从上到下、一个 block 一个二级标题；block 内组件/功能往下拆。
> 标签：`[引擎]` = `@cloudflare/speedtest` 直接给数据；`[自建]` = 需自己做；`[v1]` = 一期做；`[后期]` = 二/三期。
> 配套：整体设计见 [PRODUCT_SPEC.md](PRODUCT_SPEC.md)。最后更新 2026-07-18。

---

## A. 复刻 CF 的部分（照页面 block 顺序）

### A0. 顶栏 Header
- Logo + 产品名 "Speed Test"（换成我们的名字/logo） `[自建]`
- 右侧副标 "Built with …"（换成我们的） `[自建]`
- 底部细分隔线

### A1. Your Internet Speed（顶部速度总览，三列）

#### Download 列
- 超大数字 + 单位（`19.2 Mbps`） `[引擎]`
- 橙色填充**实时面积曲线**（边测边生长） `[引擎]`
- 曲线左上角 `90th percentile` 标注

#### Upload 列
- 超大数字（`22.0 Mbps`） `[引擎]`
- 紫色实时面积曲线 `[引擎]`
- `90th percentile` 标注

#### Latency / Jitter / Packet Loss 列
- Latency 大数字（`64.3 ms`） `[引擎]`
  - 加载延迟子项：↓ download（`85.3 ms`）／↑ upload（`86.9 ms`）
- Jitter 大数字（`27.3 ms`） `[引擎]`
  - 子项：↓（`168 ms`）／↑（`77.4 ms`）
- Packet Loss（`-` / 百分比） `[引擎]` `[v1 占位]`

#### 控制条
- Pause 暂停按钮 `[引擎]`
- Retest 重测按钮 `[引擎]`
- 分享/对比区（CF 是 Compare on Radar + X + Facebook + 下载图标 → 换成我们的分享/导出） `[自建]`
- 右侧 "Measured at HH:MM:SS" 时间戳 `[自建]`

### A2. Network Quality Score（场景评级）
- 标题 + "Learn more" 链接
- 横排三评级（每个：场景名 + Bad/Poor/Average/Good/Great 彩色字） `[引擎/AIM]`
  - Video Streaming 视频流
  - Online Gaming 在线游戏
  - Video Chatting 视频通话（RTC）

### A3. Server Location（左列）

#### 地图
- 可缩放灰度瓦片地图（MapLibre） `[自建]`
- 居中到服务器/节点位置
- 红色图钉（节点位置）
- 橙色弧线（你 → 节点）
- 缩放 +/- 控件
- 右下角归属信息 "i"

#### 连接信息（图标 + 文字）
- Connected via（IPv4 / IPv6） `[自建]`
- Server location（→ 我们显示：节点名 + 地区） `[自建]`
- Your network（ISP / AS 号，可点链接） `[自建]`
- Your IP address（可点链接） `[自建]`

### A4. Latency Measurements（右列）
- 三张**箱线图卡**，ms 轴 0–800，均可展开： `[引擎]`
  - Unloaded latency（空载，`(20/20)` 计数）
  - Latency during download（下行时，橙）
  - Latency during upload（上行时，紫）

### A5. Packet Loss Measurements（右列下）
- 单张卡 `[引擎]`
- 状态显示（成功=数值；失败=优雅提示，如 CF 的 "Unable to perform measurement: ICE connection timeout!"）
- v1 默认此块为"未测/不可用"占位 `[v1 占位 / 三期补 coturn]`

### A6. Download Measurements（左列，分档）
- 每档一张**箱线图卡**（橙），bps 轴 0–20M： `[引擎]`
  - 100kB download test（含计数 `10/10`）
  - 1MB download test
  - 10MB download test
  - （更多档位按引擎默认）
- **展开交互**（点卡片右侧箭头）：
  - 逐次测量明细表：列 `#`、`Duration`、`Speed`
  - 悬浮统计气泡：Min / Max / Average / Median / 25th percentile / 75th percentile

### A7. Upload Measurements（右列，分档）
- 同 A6，紫色 `[引擎]`
  - 100kB / 1MB / 10MB upload test …
  - 同款展开明细 + 统计

### A8. 箱线图图例规格（A4/A6/A7 通用）
- 粗条 = 25–75 百分位区间
- 实线 = 中位数
- 虚线 = 平均值
- 须 = min / max
- 散点 = 每一次测量

### A9. Footer
- Home / About / Privacy Policy / Terms of Use `[自建]`
- Logo

### A10. 全局交互 / 样式
- 页面加载自动开测 `[引擎]`
- 测试中实时进度更新（曲线、数字、进度） `[引擎]`
- 深色模式 `[自建]`
- 配色铁律：下行 = 橙、上行 = 紫
- 桌面响应式布局（手机版 `[后期]`）

---

## B. 我们的新增（CF 没有）

### B1. 节点选择 `[v1]`
- 预置节点列表（中心手动配置：名称/子域名/地区/坐标/secret）
- 点击选择要测的节点
- 切换节点重测

### B2. 节点一览表 + 连通性状态 `[v1]`
- 打开面板即展示所有节点
- 每节点 ack 握手 → 状态列：🟢在线(RTT) / 🔴不可达 / 🟡鉴权失败
- 顺带显示空载 RTT

### B3. 地图增强 `[后期]`
- 多节点在地图上标注
- 「你 → 各节点」弧线

### B4. 多节点并排对比 `[后期]`
- 同屏比多条链路的曲线 / 评级 / 指标

### B5. 历史趋势 `[后期]`
- SQLite 存历次结果
- 单条链路随时间变化的趋势图

### B6. 鉴权 `[v1]`
- 用户 ↔ 面板：**不做**，交给外层网关（反代/SSO/CF Access 等）
- 浏览器 ↔ 节点：中心签发短时 HMAC 令牌，节点无状态验签（防端点被外人滥用带宽）
- 节点 TLS 多模式:http / ip 自签 / 域名 ACME / 本机证书路径

### B7. 部署形态（非页面功能，但属清单） `[v1]`
- 中心：单 Docker 容器
- 节点：Go 单二进制 + systemd，一键交互脚本
- 节点不回连、不上报

---

## C. 技术注记（实现选型）
- 顶部实时面积曲线：**uPlot**（canvas，高频更新流畅）
- 箱线图（静态、可展开）：自定义 SVG / d3 / visx（Recharts 无原生箱线图）
- 地图：**MapLibre GL JS**（开源免费、无需 API key），灰度样式居中到节点经纬度。不用 Google Maps（按请求计费，违背自托管调性）
- UI 栈：Vite + React + Tailwind + shadcn/ui
- 后端：中心 + 节点均 Go 单二进制
- 三评级来自引擎 AIM；丢包这维 v1 缺失，评分照算并标注
