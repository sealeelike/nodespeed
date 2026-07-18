package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
)

// Token format must stay identical to node-agent/token.go:
//   token  = "<exp>.<sigHex>"
//   sigHex = hex( HMAC-SHA256(nodeSecret, "<exp>") )
// The central signs with a node's pre-shared secret; that node verifies with the
// same secret, so a token is implicitly scoped to one node.

func signToken(secret string, exp int64) string {
	expStr := strconv.FormatInt(exp, 10)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(expStr))
	return expStr + "." + hex.EncodeToString(mac.Sum(nil))
}
