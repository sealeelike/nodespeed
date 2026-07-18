# central

NodeSpeed 中心看板后端。**无登录**(用户↔面板鉴权交外层网关)。

## API

| 端点 | 说明 |
|---|---|
| `GET /api/nodes` | 节点列表(**剔除 secret**):id/name/url/region/lat/lon |
| `GET /api/token?node=ID` | 用该节点 secret 签短时 HMAC 令牌,返回 `{node,url,token,exp}` |
| `POST /api/reload` | 重读配置文件 + 重跑 GeoIP 补全,原子热切换;坏配置返回 400 且保留旧配置。返回 `{ok,count,nodes}` |
| `GET /*` | 发静态前端(SPA;无 `-static` 时给内置占位页) |

令牌算法见 [token.go](token.go),与 [../node-agent/token.go](../node-agent/token.go) 严格一致(已跨二进制端到端验证)。

## 配置

节点表 JSON,见 [nodes.example.json](nodes.example.json)。真实配置放 `nodes.json`(含 secret,已 gitignore)。
每个节点**核心只需 `ip` / `port` / `secret`**;`name` / `region` / `lat` / `lon` 由 central 用内置
GeoIP City 库反查节点 IP 自动补全,未命中或想修正时再手动填(手填即覆盖)。

| 字段 | 必填 | 说明 |
|---|---|---|
| `ip` | ✅ | 节点公网 IP(GeoIP 反查 + 默认 URL host) |
| `port` | ✅ | 节点服务端口 |
| `secret` | ✅ | 预共享 HMAC secret(仅服务端) |
| `scheme` | — | `http`/`https`,默认 `https` |
| `host` | — | 证书域名;设了则 URL 用它而非 IP(ACME 域名证书场景) |
| `id` | — | 默认 `<ip>:<port>` |
| `name`/`region`/`lat`/`lon` | — | GeoIP 自动填,手填即覆盖 |

派生出的 `URL = <scheme>://<host||ip>:<port>`,浏览器据此直连节点。

```json
{ "nodes": [
  { "ip": "203.0.113.10", "port": 8443, "secret": "..." },
  { "ip": "198.51.100.20", "port": 8443, "host": "tokyo.example.com", "secret": "...", "name": "Tokyo 1" }
] }
```

> 注:GeoIP 无数据用 `lat==0 && lon==0` 判定,故正好落在赤道/本初子午线(0,0 附近)的节点请手填 lat/lon。

## flag / env

| flag | env | 默认 | 说明 |
|---|---|---|---|
| `-listen` | `NODESPEED_LISTEN` | `:8080` | 监听地址 |
| `-config` | `NODESPEED_CONFIG` | `nodes.json` | 节点配置路径 |
| `-static` | `NODESPEED_STATIC` | (空) | 前端 dist 目录;空则内置占位页 |
| `-geoip-city` | `NODESPEED_GEOIP_CITY` | (空) | GeoIP City mmdb 路径;空则跳过自动补全,全靠手填 |
| `-token-ttl` | — | `120` | 令牌有效期(秒) |

## 构建 / 运行

```sh
go test ./...
go build -o central .
./central -listen :8090 -config nodes.json -geoip-city /path/to/city.mmdb
```
