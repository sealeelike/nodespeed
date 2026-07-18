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

// DB-IP City Lite record shape (also matches MaxMind GeoLite2-City).
type cityRecord struct {
	Location struct {
		Latitude  float64 `maxminddb:"latitude"`
		Longitude float64 `maxminddb:"longitude"`
	} `maxminddb:"location"`
	City struct {
		Names map[string]string `maxminddb:"names"`
	} `maxminddb:"city"`
	Country struct {
		ISOCode string            `maxminddb:"iso_code"`
		Names   map[string]string `maxminddb:"names"`
	} `maxminddb:"country"`
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
	parsed := net.ParseIP(ip)
	if a.asnDB != nil && parsed != nil {
		var rec asnRecord
		if err := a.asnDB.Lookup(parsed, &rec); err == nil && rec.Number != 0 {
			resp["asn"] = rec.Number
			resp["org"] = rec.Org
		}
	}
	if a.cityDB != nil && parsed != nil {
		var rec cityRecord
		if err := a.cityDB.Lookup(parsed, &rec); err == nil && (rec.Location.Latitude != 0 || rec.Location.Longitude != 0) {
			resp["lat"] = rec.Location.Latitude
			resp["lon"] = rec.Location.Longitude
			if c := rec.City.Names["en"]; c != "" {
				resp["city"] = c
			}
			if rec.Country.ISOCode != "" {
				resp["country"] = rec.Country.ISOCode
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func openMMDB(path string) (*maxminddb.Reader, error) {
	if path == "" {
		return nil, nil
	}
	return maxminddb.Open(path)
}
