package main

import (
	"testing"
	"time"
)

func TestVerifyToken(t *testing.T) {
	const secret = "s3cr3t"
	now := time.Unix(1_000_000, 0)

	valid := signToken(secret, now.Unix()+120) // expires in 2 min
	if err := verifyToken(secret, valid, now); err != nil {
		t.Fatalf("valid token rejected: %v", err)
	}

	expired := signToken(secret, now.Unix()-1)
	if err := verifyToken(secret, expired, now); err != errTokenExpired {
		t.Fatalf("expired token: got %v, want errTokenExpired", err)
	}

	// token signed with a different secret must fail (implicit node-scoping)
	other := signToken("different-secret", now.Unix()+120)
	if err := verifyToken(secret, other, now); err != errTokenSig {
		t.Fatalf("cross-secret token: got %v, want errTokenSig", err)
	}

	for _, bad := range []string{"", "nodot", "abc.def", "123.", ".sig"} {
		if err := verifyToken(secret, bad, now); err == nil {
			t.Fatalf("malformed token %q accepted", bad)
		}
	}
}
