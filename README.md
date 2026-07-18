# NodeSpeed

自建的「链路质量画像」面板:像 [speed.cloudflare.com](https://speed.cloudflare.com) 那样出上下行曲线、
加载延迟、抖动、bufferbloat 和场景化评级(游戏/视频/RTC),但测量对端是**你自己的 VPS 节点**,而不是 CF 边缘。

浏览器 → 你的节点 直连测量(client 视角),复用 CF 开源引擎 [`@cloudflare/speedtest`](https://github.com/cloudflare/speedtest),
中心看板手动配置节点、签发短时令牌、托管前端。节点被动服务、不回连、不上报。

## 文档

| 文件 | 内容 |
|---|---|
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md) | 整体设计 / 架构 / 鉴权 / 分期 |
| [FEATURES.md](FEATURES.md) | 权威功能清单 + 复刻 CF 的验收 checklist |
| [ROADMAP.md](ROADMAP.md) | 构建顺序 + 当前进度 |
| [spike/FINDINGS.md](spike/FINDINGS.md) | 阶段 0 引擎验证结论(实测 API + 请求契约) |

## 目录结构

```
nodespeed/
├── node-agent/   节点 agent(Go 单二进制:/__ack /__down /__up + HMAC 令牌 + TLS + Server-Timing)
├── central/      中心看板后端(Go:节点表 + 令牌签发 + 发前端;无登录,鉴权交外层网关)
├── frontend/     前端面板(Vite + React + Tailwind:节点列表 + 测速 UI + AIM 评级 + 地图)
├── scripts/      节点一键部署脚本(交互式:TLS 模式 / ACME / 生成 secret / 装 systemd)
└── spike/        阶段 0 一次性验证代码(可丢弃)
```

## 状态

阶段 0(引擎验证)✅ 已通过。当前进入阶段 1:最细端到端竖切。详见 [ROADMAP.md](ROADMAP.md)。

## 构建

各子项目自带说明(开发中)。节点 agent 与中心均为 Go 单静态二进制;前端 Vite 打包后内嵌进中心二进制。
