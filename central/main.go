// NetQualityPanel central panel backend.
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
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

type server struct {
	cfg      *Config
	tokenTTL time.Duration
	staticFS string
}

func (s *server) writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*") // safe: no secrets, no credentials
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *server) handleNodes(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]any{"nodes": s.cfg.publicNodes()})
}

func (s *server) handleToken(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("node")
	n, ok := s.cfg.node(id)
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

// serveStatic serves the SPA: real files if present, else index.html fallback,
// else a built-in placeholder so central runs before the frontend is built.
func (s *server) serveStatic(w http.ResponseWriter, r *http.Request) {
	if s.staticFS == "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(placeholderHTML))
		return
	}
	clean := filepath.Clean(r.URL.Path)
	p := filepath.Join(s.staticFS, clean)
	if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
		http.ServeFile(w, r, p)
		return
	}
	http.ServeFile(w, r, filepath.Join(s.staticFS, "index.html"))
}

const placeholderHTML = `<!doctype html><meta charset=utf-8>
<title>NetQualityPanel</title>
<body style="font:14px system-ui;margin:40px">
<h1>NetQualityPanel — central</h1>
<p>Backend is up. Frontend not built yet.</p>
<p>Try <a href="/api/nodes">/api/nodes</a>.</p>
</body>`

func main() {
	var (
		addr      = flag.String("listen", envOr("NQP_LISTEN", ":8080"), "listen address")
		cfgPath   = flag.String("config", envOr("NQP_CONFIG", "nodes.json"), "node config JSON")
		staticDir = flag.String("static", os.Getenv("NQP_STATIC"), "static frontend dir (empty = built-in placeholder)")
		ttl       = flag.Int("token-ttl", 120, "token lifetime in seconds")
	)
	flag.Parse()

	cfg, err := loadConfig(*cfgPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	s := &server{cfg: cfg, tokenTTL: time.Duration(*ttl) * time.Second, staticFS: *staticDir}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/nodes", s.handleNodes)
	mux.HandleFunc("/api/token", s.handleToken)
	mux.HandleFunc("/", s.serveStatic)

	log.Printf("central listening on %s (%d nodes, token-ttl=%ss, static=%q)",
		*addr, len(cfg.Nodes), strconv.Itoa(*ttl), *staticDir)
	log.Fatal(http.ListenAndServe(*addr, mux))
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
