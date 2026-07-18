package main

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/oschwald/maxminddb-golang"
)

// DB-IP ASN Lite record shape (also matches MaxMind GeoLite2-ASN).
type asnRecord struct {
	Number uint   `maxminddb:"autonomous_system_number"`
	Org    string `maxminddb:"autonomous_system_organization"`
}

// clientIP returns the peer address as seen by the node. Browsers hit the node
// directly, so RemoteAddr is the real client IP; we still honor XFF if a reverse
// proxy is ever put in front.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// GET /__meta — echoes the client IP and (if a GeoIP ASN DB is loaded) its
// autonomous system number + organization. Used for the "Connected via / Your
// network / Your IP" panel. The node never sends this anywhere; it's returned to
// the browser that asked.
func (a *agent) meta(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	if !a.checkToken(w, r, start) {
		return
	}
	a.commonHeaders(w, start)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	ip := clientIP(r)
	resp := map[string]any{"ip": ip}
	if a.asnDB != nil {
		if parsed := net.ParseIP(ip); parsed != nil {
			var rec asnRecord
			if err := a.asnDB.Lookup(parsed, &rec); err == nil && rec.Number != 0 {
				resp["asn"] = rec.Number
				resp["org"] = rec.Org
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func openASNDB(path string) (*maxminddb.Reader, error) {
	if path == "" {
		return nil, nil
	}
	return maxminddb.Open(path)
}
