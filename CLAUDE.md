# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

NodeSpeed is a self-hosted clone of speed.cloudflare.com that measures link quality
from the browser to **your own VPS nodes** instead of Cloudflare's edge. It reuses the
open-source `@cloudflare/speedtest` engine, pointing its `downloadApiUrl`/`uploadApiUrl` at
your own node agents. The browser measures each node **directly** — never through central.

Design docs are the source of truth and worth reading before non-trivial work:
`PRODUCT_SPEC.md` (architecture/auth), `FEATURES.md` (authoritative feature checklist +
CF-parity acceptance criteria), `ROADMAP.md` (build order + current progress),
`spike/FINDINGS.md` (phase-0 engine contract findings). Docs are written in Chinese.

## Three components

- **`node-agent/`** — Go single binary, runs on each VPS via systemd. Passive: never calls
  home, never reports. Serves token-gated measurement endpoints the browser hits directly.
- **`central/`** — Go single binary. **No user login** (delegated to an outer gateway). Holds
  the manually-configured node table (with per-node secrets), signs short-lived tokens, and
  serves the static frontend. Central never connects to nodes.
- **`frontend/`** — Vite + React 19 + Tailwind v4 SPA. Drives the CF engine, renders the
  CF-parity UI (uPlot live curves, SVG box plots, MapLibre map, AIM scores).

`spike/` is throwaway phase-0 verification code — don't build on it.

## The token contract (critical, spans binaries)

The browser→node auth is a pre-shared HMAC secret. Central signs, the node verifies, using
the **same secret** so a token is implicitly scoped to one node — the two never connect.

Token format, which **must stay byte-identical** in `central/token.go` and
`node-agent/token.go`:
```
token  = "<exp>.<sigHex>"
sigHex = hex( HMAC-SHA256(nodeSecret, "<exp>") )
```
Tokens ride in the URL **query** (`?token=…`), not headers — this matches how the CF engine
builds request URLs and avoids CORS preflight. If you change signing/verification, change
**both files together** (there are matching `token_test.go` in each). The two are separate Go
modules, so shared logic (token format, GeoIP `cityRecord` schema) is **intentionally
duplicated**, not imported — keep the copies in sync.

## Node config & GeoIP

`central/nodes.json` (gitignored; holds secrets) is the node table — see
`central/nodes.example.json`. Each node needs only `ip`/`port`/`secret`; `name`/`region`/
`lat`/`lon` are auto-filled by GeoIP reverse-lookup on the node IP unless overridden.
`POST /api/reload` re-reads the file and hot-swaps atomically (a bad config keeps the old one
live). GeoIP mmdb is loaded from a `-geoip-city` flag path (optional; missing DB just disables
auto-fill). "No data" is detected via the `lat==0 && lon==0` sentinel.

Central API: `GET /api/nodes` (secrets stripped), `GET /api/token?node=ID`, `POST /api/reload`,
`GET /*` (SPA, with built-in placeholder if `-static` unset).

## Build, test, run

```sh
# node-agent (static Linux binary for deploy)
cd node-agent && go test ./... && \
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o node-agent .

# central
cd central && go test ./... && go build -o central .

# frontend
cd frontend && npm run dev      # Vite dev server on :5173
cd frontend && npm run build    # tsc -b && vite build → dist/ (embed into central via -static)
cd frontend && npm run lint     # oxlint
```

Run a single Go test: `go test -run TestName ./...`

### Local dev wiring (port convention)

The Vite dev server proxies `/api` to **`http://localhost:8090`**, so run central on `:8090`
in dev even though its own default is `:8080`:
```sh
cd central && ./central -listen :8090 -config nodes.json [-geoip-city /path/city.mmdb]
```
Measurement calls go cross-origin directly to each node (nodes send CORS `*`); only `/api/*`
is proxied. The frontend routes with react-router: `/nodes` (node list + connectivity) and
`/test` (full speed test), sharing `Layout.tsx` chrome (header + dark toggle + footer).

## Conventions

- **Color rule (non-negotiable):** download = orange, upload = purple. Applies everywhere.
- Live top curves use **uPlot** (canvas). Box plots are **custom SVG** (Recharts has none).
  Map is **MapLibre GL** with CARTO Positron/Dark tiles (no API key — deliberate; no Google Maps).
- The measurement plan in `frontend/src/lib/speedtest.ts` is CF's default **minus the
  `packetLoss` step** — dropping it removes the only remaining Cloudflare network dependency
  (its TURN-credentials call). Packet loss is a deferred (phase-5/coturn) feature.
- Go binaries are gitignored (built by scripts/CI, never committed). So are `*.pem`/`*.key`,
  `nodes.json`, and `frontend/dist/`.
- `scripts/` will hold the interactive node-deploy script (phase 3, not yet built).
