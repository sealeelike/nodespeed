package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

// Pins the wire format that node-agent/token.go verifies against. Recomputes the
// HMAC independently here; if signToken drifts, nodes would reject its tokens.
func TestSignTokenVector(t *testing.T) {
	const secret = "s3cr3t"
	const exp = int64(1000120)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("1000120"))
	want := "1000120." + hex.EncodeToString(mac.Sum(nil))

	got := signToken(secret, exp)
	if got != want {
		t.Fatalf("token mismatch:\n got  %q\n want %q", got, want)
	}
	if signToken(secret, exp) != got {
		t.Fatal("signToken not deterministic")
	}
}
