# node-agent

NetQualityPanel 的节点侧测量 agent。被动服务、不回连、不上报。浏览器直连它测速(client → node)。

## 端点(均需有效 HMAC 令牌 `?token=<exp>.<sigHex>`)

| 端点 | 说明 |
|---|---|
| `GET /__ack` | 探活 + 空载 RTT + 鉴权预检 |
| `GET /__down?bytes=N` | 返回 N 字节(N=0 合法,用于加载延迟探测) |
| `POST /__up?bytes=N` | 收 body 丢弃 |

所有响应带 `Server-Timing: cfRequestDuration;dur=<ms>`(引擎据此扣除服务端耗时)、`Timing-Allow-Origin: *`、CORS。
令牌无效/过期 → 403。令牌算法见 [token.go](token.go),与中心签发一致(详见 [../PRODUCT_SPEC.md](../PRODUCT_SPEC.md) §5)。

## 配置(flag / 环境变量)

| flag | env | 默认 | 说明 |
|---|---|---|---|
| `-node-id` | `NQP_NODE_ID` | `node` | 节点标识(仅日志) |
| `-secret` | `NQP_SECRET` | — | 预共享 HMAC secret(**必填**) |
| `-listen` | `NQP_LISTEN` | `:8443` | 监听地址 |
| `-tls-mode` | `NQP_TLS_MODE` | `http` | `http` / `cert` / `selfsign` |
| `-cert` `-key` | `NQP_CERT` `NQP_KEY` | — | 证书路径(`tls-mode=cert`) |
| `-allow-origin` | `NQP_ALLOW_ORIGIN` | `*` | CORS 允许来源 |

TLS 模式:`http`(明文调试)、`cert`(本机证书路径)、`selfsign`(裸 IP 自签,浏览器需手动信任)。
域名 ACME 由部署脚本层用 acme.sh 处理,证书落地后以 `cert` 模式加载。

## 构建 / 测试

```sh
go test ./...
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o node-agent .
```

## 运行(systemd 示例)

```sh
systemd-run --unit=nqp-agent --setenv=NQP_SECRET=xxxx \
  /usr/local/bin/node-agent -node-id hk1 -listen :8443 -tls-mode cert \
  -cert /path/fullchain.pem -key /path/privkey.pem
```
