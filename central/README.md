# central

NetQualityPanel 中心看板后端。**无登录**(用户↔面板鉴权交外层网关)。

## API

| 端点 | 说明 |
|---|---|
| `GET /api/nodes` | 节点列表(**剔除 secret**):id/name/url/region/lat/lon |
| `GET /api/token?node=ID` | 用该节点 secret 签短时 HMAC 令牌,返回 `{node,url,token,exp}` |
| `GET /*` | 发静态前端(SPA;无 `-static` 时给内置占位页) |

令牌算法见 [token.go](token.go),与 [../node-agent/token.go](../node-agent/token.go) 严格一致(已跨二进制端到端验证)。

## 配置

节点表 JSON,见 [nodes.example.json](nodes.example.json)。真实配置放 `nodes.json`(含 secret,已 gitignore)。

```json
{ "nodes": [ { "id": "hk1", "name": "...", "url": "https://host:8443", "region": "...", "lat": 0, "lon": 0, "secret": "..." } ] }
```

## flag / env

| flag | env | 默认 | 说明 |
|---|---|---|---|
| `-listen` | `NQP_LISTEN` | `:8080` | 监听地址 |
| `-config` | `NQP_CONFIG` | `nodes.json` | 节点配置路径 |
| `-static` | `NQP_STATIC` | (空) | 前端 dist 目录;空则内置占位页 |
| `-token-ttl` | — | `120` | 令牌有效期(秒) |

## 构建 / 运行

```sh
go test ./...
go build -o central .
./central -listen :8090 -config nodes.json
```
