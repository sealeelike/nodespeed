package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// Node is one manually-configured backend node. Operators only need to supply
// ip / port / secret; name / region / lat / lon are auto-filled from the node's
// IP via the embedded GeoIP City DB (see geoip.go) unless explicitly overridden.
// The secret NEVER leaves the central (stripped from /api/nodes).
type Node struct {
	// --- input (JSON) ---
	IP     string  `json:"ip"`               // REQUIRED — public IP (GeoIP lookup + default URL host)
	Port   int     `json:"port"`             // REQUIRED
	Secret string  `json:"secret"`           // REQUIRED — pre-shared HMAC secret (server-side only)
	Scheme string  `json:"scheme,omitempty"` // optional — default "https"
	Host   string  `json:"host,omitempty"`   // optional cert hostname for the URL — default = ip
	ID     string  `json:"id,omitempty"`     // optional — default "<ip>:<port>"
	Name   string  `json:"name,omitempty"`   // optional override — else GeoIP city
	Region string  `json:"region,omitempty"` // optional override — else GeoIP city/country
	Lat    float64 `json:"lat,omitempty"`    // optional override — else GeoIP
	Lon    float64 `json:"lon,omitempty"`    // optional override — else GeoIP
	// --- derived at load ---
	URL string `json:"-"` // built from scheme/host/port, e.g. https://hk1.example.com:8443
}

// PublicNode is what the frontend sees — no secret.
type PublicNode struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	URL    string  `json:"url"`
	Region string  `json:"region"`
	Lat    float64 `json:"lat"`
	Lon    float64 `json:"lon"`
}

type Config struct {
	Nodes []Node `json:"nodes"`
}

func loadConfig(path string) (*Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var c Config
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	seen := map[string]bool{}
	// iterate by index so derived fields (URL, ID) persist back into the slice
	for i := range c.Nodes {
		n := &c.Nodes[i]
		if n.IP == "" {
			return nil, fmt.Errorf("node[%d] missing ip", i)
		}
		if n.Port == 0 {
			return nil, fmt.Errorf("node %q missing port", n.IP)
		}
		if n.Secret == "" {
			return nil, fmt.Errorf("node %q missing secret", n.IP)
		}
		if n.Scheme == "" {
			n.Scheme = "https"
		}
		host := n.Host
		if host == "" {
			host = n.IP
		}
		n.URL = fmt.Sprintf("%s://%s:%d", n.Scheme, host, n.Port)
		if n.ID == "" {
			n.ID = fmt.Sprintf("%s:%d", n.IP, n.Port)
		}
		if seen[n.ID] {
			return nil, fmt.Errorf("duplicate node id %q", n.ID)
		}
		seen[n.ID] = true
	}
	return &c, nil
}

func (c *Config) node(id string) (*Node, bool) {
	for i := range c.Nodes {
		if c.Nodes[i].ID == id {
			return &c.Nodes[i], true
		}
	}
	return nil, false
}

func (c *Config) publicNodes() []PublicNode {
	out := make([]PublicNode, 0, len(c.Nodes))
	for _, n := range c.Nodes {
		out = append(out, PublicNode{ID: n.ID, Name: n.Name, URL: n.URL, Region: n.Region, Lat: n.Lat, Lon: n.Lon})
	}
	return out
}
