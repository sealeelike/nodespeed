package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// Node is one manually-configured backend node. The secret NEVER leaves the
// central (it's stripped from the public /api/nodes response).
type Node struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	URL    string  `json:"url"`    // base URL of the node agent, e.g. https://hk1.example.com:8443
	Region string  `json:"region"` // human label, e.g. "Hong Kong"
	Lat    float64 `json:"lat"`
	Lon    float64 `json:"lon"`
	Secret string  `json:"secret"` // pre-shared HMAC secret (kept server-side only)
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
	for i, n := range c.Nodes {
		if n.ID == "" {
			return nil, fmt.Errorf("node[%d] missing id", i)
		}
		if seen[n.ID] {
			return nil, fmt.Errorf("duplicate node id %q", n.ID)
		}
		seen[n.ID] = true
		if n.Secret == "" {
			return nil, fmt.Errorf("node %q missing secret", n.ID)
		}
		if n.URL == "" {
			return nil, fmt.Errorf("node %q missing url", n.ID)
		}
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
