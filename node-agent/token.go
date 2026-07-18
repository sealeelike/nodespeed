package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"
)

// Token format: "<exp>.<sigHex>"
//   exp    = unix seconds (int, as decimal string)
//   sigHex = hex( HMAC-SHA256(secret, "<exp>") )
//
// The central signs with a node's pre-shared secret; the node verifies with the
// same secret. A token signed for another node (different secret) fails here, so
// node-scoping is implicit. Tokens are short-lived (exp ~2min); a leaked token is
// only usable until it expires. See PRODUCT_SPEC.md §5.

var (
	errTokenFormat  = errors.New("bad token format")
	errTokenExpired = errors.New("token expired")
	errTokenSig     = errors.New("token signature mismatch")
)

func signToken(secret string, exp int64) string {
	expStr := strconv.FormatInt(exp, 10)
	return expStr + "." + hmacHex(secret, expStr)
}

func verifyToken(secret, token string, now time.Time) error {
	dot := strings.IndexByte(token, '.')
	if dot <= 0 || dot == len(token)-1 {
		return errTokenFormat
	}
	expStr, sig := token[:dot], token[dot+1:]
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil {
		return errTokenFormat
	}
	want := hmacHex(secret, expStr)
	// constant-time compare to avoid timing leaks
	if !hmac.Equal([]byte(sig), []byte(want)) {
		return errTokenSig
	}
	if now.Unix() > exp {
		return errTokenExpired
	}
	return nil
}

func hmacHex(secret, msg string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(msg))
	return hex.EncodeToString(mac.Sum(nil))
}
