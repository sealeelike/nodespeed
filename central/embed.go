package main

import (
	"embed"
	"io/fs"
)

// The frontend build output is copied into ./webroot before `go build` (see the
// build steps in CLAUDE.md / the Dockerfile). go:embed cannot reference paths
// outside the package directory, which is why the build copies dist in rather
// than embedding frontend/dist directly. A committed webroot/.gitkeep keeps this
// pattern matchable even when the frontend hasn't been built yet.
//
//go:embed all:webroot
var embeddedWeb embed.FS

// embeddedWebFS returns the embedded frontend rooted at webroot/. When only
// .gitkeep is present (frontend not built in), index.html is simply absent and
// serveStatic falls back to the built-in placeholder page.
func embeddedWebFS() fs.FS {
	sub, err := fs.Sub(embeddedWeb, "webroot")
	if err != nil {
		return nil
	}
	return sub
}
