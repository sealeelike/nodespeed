// NodeSpeed node agent.
//
// A passive, long-running measurement endpoint that the browser hits directly
// (client -> node), driven by @cloudflare/speedtest. It does NOT call home and
// does NOT report anything. Endpoints require a short-lived HMAC token signed by
// the central panel with this node's pre-shared secret.
//
//	GET  /__ack           token-gated liveness + unloaded-RTT + auth precheck
//	GET  /__down?bytes=N  streams N zero bytes (N=0 allowed, used for loaded latency)
//	POST /__up?bytes=N    drains the request body
//
// All measurement responses carry Server-Timing: cfRequestDuration;dur=<ms> so
// the engine can subtract server processing time. See spike/FINDINGS.md §2.
package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"flag"
	"fmt"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/oschwald/maxminddb-golang"
)

type config struct {
	nodeID      string
	secret      string
	listen      string
	tlsMode     string // http | cert | selfsign
	certPath    string
	keyPath     string
	allowOrigin string
	geoipASN    string // path to a GeoIP ASN mmdb (optional)
	geoipCity   string // path to a GeoIP City mmdb (optional)
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func loadConfig() config {
	c := config{}
	flag.StringVar(&c.nodeID, "node-id", envOr("NODESPEED_NODE_ID", "node"), "node identifier (for logs)")
	flag.StringVar(&c.secret, "secret", os.Getenv("NODESPEED_SECRET"), "pre-shared HMAC secret (or env NODESPEED_SECRET)")
	flag.StringVar(&c.listen, "listen", envOr("NODESPEED_LISTEN", ":8443"), "listen address")
	flag.StringVar(&c.tlsMode, "tls-mode", envOr("NODESPEED_TLS_MODE", "http"), "http | cert | selfsign")
	flag.StringVar(&c.certPath, "cert", os.Getenv("NODESPEED_CERT"), "TLS cert path (tls-mode=cert)")
	flag.StringVar(&c.keyPath, "key", os.Getenv("NODESPEED_KEY"), "TLS key path (tls-mode=cert)")
	flag.StringVar(&c.allowOrigin, "allow-origin", envOr("NODESPEED_ALLOW_ORIGIN", "*"), "Access-Control-Allow-Origin value")
	flag.StringVar(&c.geoipASN, "geoip-asn", os.Getenv("NODESPEED_GEOIP_ASN"), "path to GeoIP ASN mmdb (optional, for /__meta ISP/AS)")
	flag.StringVar(&c.geoipCity, "geoip-city", os.Getenv("NODESPEED_GEOIP_CITY"), "path to GeoIP City mmdb (optional, for /__meta lat/lon/city)")
	flag.Parse()
	return c
}

// one shared zero buffer we slice from, to avoid per-request allocation
var zeros = make([]byte, 1<<20) // 1 MiB

type agent struct {
	cfg    config
	asnDB  *maxminddb.Reader
	cityDB *maxminddb.Reader
}

func (a *agent) commonHeaders(w http.ResponseWriter, start time.Time) {
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", a.cfg.allowOrigin)
	h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "*")
	h.Set("Timing-Allow-Origin", "*")
	dur := float64(time.Since(start).Microseconds()) / 1000.0
	h.Set("Server-Timing", fmt.Sprintf("cfRequestDuration;dur=%.3f", dur))
	h.Set("Cache-Control", "no-store")
}

// checkToken returns true if the request carries a valid, unexpired token.
// On failure it writes the appropriate status (with CORS headers) and returns false.
func (a *agent) checkToken(w http.ResponseWriter, r *http.Request, start time.Time) bool {
	if r.Method == http.MethodOptions { // CORS preflight: no token needed
		return true
	}
	tok := r.URL.Query().Get("token")
	if err := verifyToken(a.cfg.secret, tok, time.Now()); err != nil {
		a.commonHeaders(w, start)
		w.WriteHeader(http.StatusForbidden)
		fmt.Fprintf(w, "403 %v", err)
		return false
	}
	return true
}

func (a *agent) ack(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	if !a.checkToken(w, r, start) {
		return
	}
	a.commonHeaders(w, start)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (a *agent) down(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	if !a.checkToken(w, r, start) {
		return
	}
	if r.Method == http.MethodOptions {
		a.commonHeaders(w, start)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	n, _ := strconv.Atoi(r.URL.Query().Get("bytes"))
	if n < 0 {
		n = 0
	}
	a.commonHeaders(w, start)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.Itoa(n))
	w.WriteHeader(http.StatusOK)
	for n > 0 {
		chunk := len(zeros)
		if n < chunk {
			chunk = n
		}
		if _, err := w.Write(zeros[:chunk]); err != nil {
			return
		}
		n -= chunk
	}
}

func (a *agent) up(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	if !a.checkToken(w, r, start) {
		return
	}
	if r.Method == http.MethodOptions {
		a.commonHeaders(w, start)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	n, _ := io.Copy(io.Discard, r.Body)
	a.commonHeaders(w, start)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "%d", n)
}

func (a *agent) routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/__ack", a.ack)
	mux.HandleFunc("/__down", a.down)
	mux.HandleFunc("/__up", a.up)
	mux.HandleFunc("/__meta", a.meta)
	return mux
}

func main() {
	cfg := loadConfig()
	if cfg.secret == "" {
		log.Fatal("no secret set (use -secret or env NODESPEED_SECRET)")
	}
	a := &agent{cfg: cfg}
	if db, err := openMMDB(cfg.geoipASN); err != nil {
		log.Printf("geoip: %v (continuing without ASN lookup)", err)
	} else if db != nil {
		a.asnDB = db
		defer db.Close()
		log.Printf("geoip ASN db loaded: %s", cfg.geoipASN)
	}
	if db, err := openMMDB(cfg.geoipCity); err != nil {
		log.Printf("geoip city: %v (continuing without city lookup)", err)
	} else if db != nil {
		a.cityDB = db
		defer db.Close()
		log.Printf("geoip City db loaded: %s", cfg.geoipCity)
	}
	srv := &http.Server{Addr: cfg.listen, Handler: a.routes()}

	log.Printf("node-agent %q listening on %s (tls-mode=%s)", cfg.nodeID, cfg.listen, cfg.tlsMode)
	switch cfg.tlsMode {
	case "http":
		log.Fatal(srv.ListenAndServe())
	case "cert":
		if cfg.certPath == "" || cfg.keyPath == "" {
			log.Fatal("tls-mode=cert requires -cert and -key")
		}
		log.Fatal(srv.ListenAndServeTLS(cfg.certPath, cfg.keyPath))
	case "selfsign":
		cert, err := selfSignedCert(cfg.listen)
		if err != nil {
			log.Fatalf("selfsign: %v", err)
		}
		srv.TLSConfig = &tls.Config{Certificates: []tls.Certificate{cert}}
		log.Fatal(srv.ListenAndServeTLS("", ""))
	default:
		log.Fatalf("unknown tls-mode %q (want http|cert|selfsign)", cfg.tlsMode)
	}
}

// selfSignedCert makes an in-memory self-signed cert (ECDSA P-256) for bare-IP
// HTTPS. The browser will warn until the user trusts it; fine for IP-only nodes.
func selfSignedCert(listen string) (tls.Certificate, error) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	tmpl := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "nodespeed-node"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().AddDate(10, 0, 0),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	// best-effort: attach the host's non-loopback IPs as SANs
	if addrs, e := net.InterfaceAddrs(); e == nil {
		for _, addr := range addrs {
			if ipn, ok := addr.(*net.IPNet); ok && !ipn.IP.IsLoopback() {
				tmpl.IPAddresses = append(tmpl.IPAddresses, ipn.IP)
			}
		}
	}
	der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &priv.PublicKey, priv)
	if err != nil {
		return tls.Certificate{}, err
	}
	keyDER, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		return tls.Certificate{}, err
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	return tls.X509KeyPair(certPEM, keyPEM)
}
