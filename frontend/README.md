# frontend

NodeSpeed 前端(Vite + React + TS + Tailwind v4)。阶段 1:节点列表 + 连通性 + 测速三列 + AIM 评级。

## 数据流

1. 载入 `/api/nodes`(经 Vite 代理到中心)→ 渲染节点表。
2. 对每个节点做 ack 握手(`fetchToken` → 打节点 `/__ack` 量 RTT)→ 连通性状态(在线/不可达/鉴权失败)。
3. 点节点 → 取令牌 → `@cloudflare/speedtest` 指向该节点(token 放进 base URL query;measurements 去掉 packetLoss,零 CF 依赖)。
4. `onResultsChange` 喂实时曲线(uPlot,下行橙/上行紫),`onFinish` 出 AIM 三评级。

## 开发

需要中心后端在 `:8090`(见 [../central](../central))。Vite `server.proxy` 把 `/api` 转发过去;
节点测量走跨域直连(节点发 CORS `*`)。

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # 产物 dist/,交给中心 -static 托管
```

## 结构

- `src/api.ts` — 中心 API 客户端 + ack 握手
- `src/lib/speedtest.ts` — `@cloudflare/speedtest` 封装(measurements 去 packetLoss,token 注入,结果抽取)
- `src/components/NodeList.tsx` — 连通性表
- `src/components/SpeedPanel.tsx` — 三列 + AIM
- `src/components/LiveChart.tsx` — uPlot 面积曲线

阶段 2 再加:箱线图、展开明细、连接信息、MapLibre 地图、深色模式、像素级保真。
