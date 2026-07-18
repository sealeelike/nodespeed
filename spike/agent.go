// Phase-0 throwaway spike agent.
// Serves the test HTML AND the measurement endpoints from one origin (no CORS
// headache), so the browser just opens http://<node>:8080/ and everything runs.
// Goal: prove @cloudflare/speedtest drives our own endpoints and produces
// curves + AIM + per-measurement raw data. NOT production code.
package main

import (
	_ "embed"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

//go:embed index.html
var indexHTML []byte

// one big zero buffer we slice from, to avoid per-request allocation
var zeros = make([]byte, 1<<20) // 1 MiB

func commonHeaders(w http.ResponseWriter, start time.Time) {
	h := w.Header()
	// open CORS + allow the browser to read Server-Timing cross-origin
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "*")
	h.Set("Timing-Allow-Origin", "*")
	// CF emits Server-Timing: cfRequestDuration;dur=<ms>; the engine subtracts it.
	dur := float64(time.Since(start).Microseconds()) / 1000.0
	h.Set("Server-Timing", fmt.Sprintf("cfRequestDuration;dur=%.3f", dur))
	h.Set("Cache-Control", "no-store")
}

func down(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	if r.Method == http.MethodOptions {
		commonHeaders(w, start)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	n, _ := strconv.Atoi(r.URL.Query().Get("bytes"))
	if n <= 0 {
		n = 0
	}
	commonHeaders(w, start)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.Itoa(n))
	w.WriteHeader(http.StatusOK)
	remaining := n
	for remaining > 0 {
		chunk := len(zeros)
		if remaining < chunk {
			chunk = remaining
		}
		if _, err := w.Write(zeros[:chunk]); err != nil {
			return
		}
		remaining -= chunk
	}
}

func up(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	if r.Method == http.MethodOptions {
		commonHeaders(w, start)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	n, _ := io.Copy(io.Discard, r.Body)
	commonHeaders(w, start)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "%d", n)
}

func ack(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	commonHeaders(w, start)
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

// result sink: the page POSTs its full findings here so we can read them via ssh.
func result(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	commonHeaders(w, start)
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 8<<20))
	ts := time.Now().UTC().Format("20060102T150405Z")
	_ = os.MkdirAll("results", 0o755)
	path := filepath.Join("results", "result-"+ts+".json")
	if err := os.WriteFile(path, body, 0o644); err != nil {
		log.Printf("write result failed: %v", err)
	} else {
		log.Printf("=== RESULT SAVED: %s (%d bytes) ===", path, len(body))
	}
	w.Header().Set("Content-Type", "text/plain")
	_, _ = w.Write([]byte("saved"))
}

func root(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(indexHTML)
}

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("/", root)
	mux.HandleFunc("/__ack", ack)
	mux.HandleFunc("/__down", down)
	mux.HandleFunc("/__up", up)
	mux.HandleFunc("/__result", result)

	log.Printf("spike agent listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, mux))
}
