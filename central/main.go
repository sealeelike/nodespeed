// NodeSpeed central panel backend.
//
// Responsibilities (NO user login — that's delegated to an outer gateway):
//   - hold the manually-configured node table (with per-node secrets)
//   - GET /api/nodes         list nodes (secrets stripped)
//   - GET /api/token?node=ID sign a short-lived HMAC token with the node's secret
//   - serve the static frontend (SPA)
//
// The signed token lets the browser talk directly to the node agent; the node
// verifies it statelessly. Central never connects to the nodes.
package main

import (
	"encoding/json"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path"
	"strings"
	"sync/atomic"
	"time"

	"github.com/oschwald/maxminddb-golang"
)

type server struct {
	cfg      atomic.Pointer[Config] // hot-swappable on reload; read lock-free via Load()
	cfgPath  string                 // re-read by /api/reload
	cityDB   *maxminddb.Reader      // opened once, reused across reloads (may be nil)
	tokenTTL time.Duration
	web      fs.FS        // frontend files: embedded, or -static dir override
	fileSrv  http.Handler // static file server over web
}

func (s *server) writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*") // safe: no secrets, no credentials
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *server) handleNodes(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]any{"nodes": s.cfg.Load().publicNodes()})
}

func (s *server) handleToken(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("node")
	n, ok := s.cfg.Load().node(id)
	if !ok {
		s.writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown node"})
		return
	}
	exp := time.Now().Add(s.tokenTTL).Unix()
	s.writeJSON(w, http.StatusOK, map[string]any{
		"node":  n.ID,
		"url":   n.URL,
		"token": signToken(n.Secret, exp),
		"exp":   exp,
	})
}

// handleReload re-reads the config file, re-runs GeoIP auto-fill, and atomically
// swaps it in. A bad config keeps the current one live (never swaps in broken).
func (s *server) handleReload(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		s.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST only"})
		return
	}
	cfg, err := loadConfig(s.cfgPath)
	if err != nil {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	geoFill(cfg, s.cityDB)
	s.cfg.Store(cfg)
	log.Printf("config reloaded: %d nodes", len(cfg.Nodes))
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "count": len(cfg.Nodes), "nodes": cfg.publicNodes()})
}

// serveStatic serves the SPA from s.web (embedded frontend, or the -static
// override): the real file when it exists, else index.html (so client-side
// routes like /nodes and /test resolve), else a built-in placeholder when the
// frontend hasn't been built in yet.
func (s *server) serveStatic(w http.ResponseWriter, r *http.Request) {
	if s.web != nil {
		if p := strings.TrimPrefix(path.Clean(r.URL.Path), "/"); p != "" {
			if fi, err := fs.Stat(s.web, p); err == nil && !fi.IsDir() {
				s.fileSrv.ServeHTTP(w, r)
				return
			}
		}
		if b, err := fs.ReadFile(s.web, "index.html"); err == nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(b)
			return
		}
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(placeholderHTML))
}

const placeholderHTML = `<!doctype html><meta charset=utf-8>
<title>NodeSpeed</title>
<body style="font:14px system-ui;margin:40px">
<h1>NodeSpeed — central</h1>
<p>Backend is up. Frontend not built yet.</p>
<p>Try <a href="/api/nodes">/api/nodes</a>.</p>
</body>`

func main() {
	var (
		addr      = flag.String("listen", envOr("NODESPEED_LISTEN", ":8080"), "listen address")
		cfgPath   = flag.String("config", envOr("NODESPEED_CONFIG", "nodes.json"), "node config JSON")
		staticDir = flag.String("static", os.Getenv("NODESPEED_STATIC"), "static frontend dir override (empty = use embedded frontend)")
		geoipCity = flag.String("geoip-city", os.Getenv("NODESPEED_GEOIP_CITY"), "path to GeoIP City mmdb (optional; auto-fills node lat/lon/name/region)")
		ttl       = flag.Int("token-ttl", 120, "token lifetime in seconds")
	)
	flag.Parse()

	cfg, err := loadConfig(*cfgPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	cityDB, err := openMMDB(*geoipCity)
	if err != nil {
		log.Printf("geoip city: %v (continuing without geo-fill)", err)
	}
	geoFill(cfg, cityDB)

	// Frontend source: -static dir override (dev convenience) or the embedded
	// build. Either way serveStatic falls back to a placeholder if index.html
	// is missing (e.g. embedded webroot holds only .gitkeep).
	web := embeddedWebFS()
	webSrc := "embedded"
	if *staticDir != "" {
		web = os.DirFS(*staticDir)
		webSrc = *staticDir
	}

	s := &server{cfgPath: *cfgPath, cityDB: cityDB, tokenTTL: time.Duration(*ttl) * time.Second, web: web}
	s.fileSrv = http.FileServerFS(web)
	s.cfg.Store(cfg)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/nodes", s.handleNodes)
	mux.HandleFunc("/api/token", s.handleToken)
	mux.HandleFunc("/api/reload", s.handleReload)
	mux.HandleFunc("/", s.serveStatic)

	log.Printf("central listening on %s (%d nodes, token-ttl=%ds, frontend=%s, geoip=%v)",
		*addr, len(cfg.Nodes), *ttl, webSrc, cityDB != nil)
	log.Fatal(http.ListenAndServe(*addr, mux))
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
