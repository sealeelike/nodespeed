package main

import (
	"net"

	"github.com/oschwald/maxminddb-golang"
)

// cityRecord mirrors the subset of the DB-IP City Lite / MaxMind GeoLite2-City
// schema we use. Kept in sync with node-agent/meta.go (the two are separate Go
// modules, so this is duplicated rather than imported).
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

// openMMDB opens a GeoIP mmdb; an empty path is a soft no-op (returns nil, nil)
// so a missing DB just disables auto-fill rather than failing startup.
func openMMDB(path string) (*maxminddb.Reader, error) {
	if path == "" {
		return nil, nil
	}
	return maxminddb.Open(path)
}

// geoFill auto-populates Lat/Lon/Name/Region from the City DB for any field the
// operator did NOT override. No-op when db is nil, the IP is unparseable, or the
// lookup misses. Uses the same lat==0 && lon==0 "no data" sentinel as node-agent.
func geoFill(c *Config, db *maxminddb.Reader) {
	if db == nil {
		return
	}
	for i := range c.Nodes {
		n := &c.Nodes[i]
		parsed := net.ParseIP(n.IP)
		if parsed == nil {
			continue
		}
		var rec cityRecord
		if err := db.Lookup(parsed, &rec); err != nil {
			continue
		}
		lat, lon := rec.Location.Latitude, rec.Location.Longitude
		if lat == 0 && lon == 0 {
			continue
		}
		city := rec.City.Names["en"]
		country := rec.Country.ISOCode
		if n.Lat == 0 && n.Lon == 0 {
			n.Lat, n.Lon = lat, lon
		}
		if n.Name == "" {
			switch {
			case city != "":
				n.Name = city
			case country != "":
				n.Name = country
			default:
				n.Name = n.IP
			}
		}
		if n.Region == "" {
			if city != "" {
				n.Region = city
			} else {
				n.Region = country
			}
		}
	}
}
