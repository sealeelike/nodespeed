#!/usr/bin/env bash
# nodespeed-lib.sh — shared helpers for install.sh and the `nsp` management menu.
# This file is SOURCED, never executed directly. All node state lives in
# $NS_CONF as KEY=VALUE lines (mode 600). The nodespeed-agent reads the
# NODESPEED_* vars via systemd EnvironmentFile; the NS_* vars are metadata used
# only by these scripts (to render the central-side config block).

# ---- paths / constants -------------------------------------------------------
NS_REPO="${NS_REPO:-sealeelike/nodespeed}"
NS_BRANCH="${NS_BRANCH:-main}"
NS_DIR=/etc/nodespeed
NS_CONF="$NS_DIR/nodespeed.conf"
NS_CERT_DIR="$NS_DIR/cert"
NS_BIN=/usr/local/bin/nodespeed-agent
NS_SVC=nodespeed-agent
NS_UNIT="/etc/systemd/system/${NS_SVC}.service"
NS_LIBDST=/usr/local/lib/nodespeed/nodespeed-lib.sh
NS_MENUDST=/usr/bin/nsp
ACME="${HOME:-/root}/.acme.sh/acme.sh"

# ---- output helpers ----------------------------------------------------------
_c() { printf '\033[%sm' "$1"; }
LOGI() { printf '%s[信息]%s %s\n' "$(_c '0;32')" "$(_c 0)" "$*"; }
LOGW() { printf '%s[注意]%s %s\n' "$(_c '0;33')" "$(_c 0)" "$*"; }
LOGE() { printf '%s[错误]%s %s\n' "$(_c '0;31')" "$(_c 0)" "$*" >&2; }
HR()   { printf '%s\n' "------------------------------------------------------------"; }

require_root() { [ "${EUID:-$(id -u)}" -eq 0 ] || { LOGE "请用 root 运行"; exit 1; }; }

# ---- config read / write -----------------------------------------------------
ns_load() { [ -f "$NS_CONF" ] && . "$NS_CONF"; return 0; }

# ns_set KEY VALUE — upsert one line into $NS_CONF (creates file 600 if absent).
ns_set() {
	local k="$1" v="$2"
	mkdir -p "$NS_DIR"; touch "$NS_CONF"; chmod 600 "$NS_CONF"
	if grep -q "^${k}=" "$NS_CONF" 2>/dev/null; then
		sed -i "s|^${k}=.*|${k}=${v}|" "$NS_CONF"
	else
		printf '%s=%s\n' "$k" "$v" >> "$NS_CONF"
	fi
}

# ---- primitives --------------------------------------------------------------
ns_port() { ns_load; printf '%s' "${NODESPEED_LISTEN##*:}"; }   # ":8443" -> "8443"

ns_gen_secret() { openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32; }

# Sign a short-lived token EXACTLY like central/token.go & node-agent/token.go:
#   token = "<exp>.<hex(HMAC-SHA256(secret, "<exp>"))>"
ns_sign_token() {
	local secret="$1" exp sig
	exp=$(( $(date +%s) + 120 ))
	sig=$(printf '%s' "$exp" | openssl dgst -sha256 -hmac "$secret" | awk '{print $NF}')
	printf '%s.%s' "$exp" "$sig"
}

ns_public_ip() {
	local u ip
	for u in https://api.ipify.org https://ipv4.icanhazip.com https://ifconfig.me/ip; do
		ip=$(curl -fsS4 --max-time 5 "$u" 2>/dev/null | tr -d '[:space:]')
		[ -n "$ip" ] && { printf '%s' "$ip"; return 0; }
	done
	return 1
}

ns_port_used() {
	local p="$1"
	if command -v ss >/dev/null 2>&1; then
		ss -Hltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${p}\$"
	elif command -v netstat >/dev/null 2>&1; then
		netstat -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${p}\$"
	else
		return 1
	fi
}

# Ports browsers refuse to connect to (Chrome/Firefox -> net::ERR_UNSAFE_PORT).
# The whole product is browser->node measurement, so binding one of these makes
# the node unreachable from the panel no matter what. Kept in sync with Chromium
# net/base/port_util.cc kRestrictedPorts.
NS_BLOCKED_PORTS=" 1 7 9 11 13 15 17 19 20 21 22 23 25 37 42 43 53 69 77 79 87 95 101 102 103 104 109 110 111 113 115 117 119 123 135 137 139 143 161 179 389 427 465 512 513 514 515 526 530 531 532 540 548 554 556 563 587 601 636 989 990 993 995 1719 1720 1723 2049 3659 4045 5060 5061 6000 6566 6665 6666 6667 6668 6669 6697 10080 "
ns_port_blocked() { case "$NS_BLOCKED_PORTS" in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

# ---- acme.sh -----------------------------------------------------------------
ns_install_acme() {
	[ -x "$ACME" ] && return 0
	LOGI "安装 acme.sh ..."
	curl -fsS https://get.acme.sh | sh >/dev/null 2>&1
	ACME="${HOME:-/root}/.acme.sh/acme.sh"
	[ -x "$ACME" ] || { LOGE "acme.sh 安装失败"; return 1; }
	"$ACME" --upgrade --auto-upgrade >/dev/null 2>&1 || true
}

# ns_issue_cert <domain|ip> <httpport> <is_ip:0|1>
# Issues via HTTP-01 standalone, installs to $NS_CERT_DIR/<id>/, wires reloadcmd
# to restart the agent so renewals take effect (critical for 6-day IP certs).
ns_issue_cert() {
	local id="$1" httpport="$2" is_ip="$3" dir="$NS_CERT_DIR/$1"
	ns_install_acme || return 1
	mkdir -p "$dir"
	"$ACME" --set-default-ca --server letsencrypt >/dev/null 2>&1 || true
	if [ "$is_ip" = 1 ]; then
		LOGW "IP 证书是 6 天短证书,acme.sh 会每几天自动续一次。"
		"$ACME" --issue -d "$id" --standalone --httpport "$httpport" \
			--server letsencrypt --certificate-profile shortlived --days 5 --force || return 1
	else
		"$ACME" --issue -d "$id" --standalone --httpport "$httpport" --force || return 1
	fi
	"$ACME" --install-cert -d "$id" \
		--key-file "$dir/privkey.pem" \
		--fullchain-file "$dir/fullchain.pem" \
		--reloadcmd "systemctl restart ${NS_SVC}" --force || return 1
	NS_CERT_INSTALLED="$dir/fullchain.pem"
	NS_KEY_INSTALLED="$dir/privkey.pem"
	return 0
}

# ---- systemd -----------------------------------------------------------------
ns_write_unit() {
	cat > "$NS_UNIT" <<EOF
[Unit]
Description=NodeSpeed node agent
After=network.target

[Service]
Type=simple
EnvironmentFile=${NS_CONF}
ExecStart=${NS_BIN}
Restart=on-failure
RestartSec=3
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
	chmod 644 "$NS_UNIT"
	systemctl daemon-reload
}

ns_enable_start() { systemctl enable "$NS_SVC" >/dev/null 2>&1; systemctl restart "$NS_SVC"; }
ns_is_active()  { systemctl is-active "$NS_SVC" 2>/dev/null; }
ns_is_enabled() { systemctl is-enabled "$NS_SVC" 2>/dev/null; }

# ---- diagnostics -------------------------------------------------------------
# Cert expiry "YYYY-MM-DD (N 天后)" for the active cert, or "-".
ns_cert_expiry() {
	ns_load
	[ "${NODESPEED_TLS_MODE:-}" = cert ] && [ -f "${NODESPEED_CERT:-/nonexistent}" ] || { printf '%s' '-'; return; }
	local end days
	end=$(openssl x509 -enddate -noout -in "$NODESPEED_CERT" 2>/dev/null | cut -d= -f2)
	[ -n "$end" ] || { printf '%s' '-'; return; }
	days=$(( ( $(date -d "$end" +%s 2>/dev/null || echo 0) - $(date +%s) ) / 86400 ))
	printf '%s (%s 天后到期)' "$(date -d "$end" +%Y-%m-%d 2>/dev/null || echo "$end")" "$days"
}

# Sign a token locally and hit our own /__ack over loopback (-k: localhost won't
# match the cert CN, we only want endpoint liveness + TLS handshake). 200 = ok.
ns_selftest() {
	ns_load
	local port scheme tok code
	port="${NODESPEED_LISTEN##*:}"
	[ "${NODESPEED_TLS_MODE:-}" = http ] && scheme=http || scheme=https
	tok=$(ns_sign_token "${NODESPEED_SECRET:-}")
	code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 "${scheme}://127.0.0.1:${port}/__ack?token=${tok}" 2>/dev/null)
	[ "$code" = 200 ]
}

# ---- central config block ----------------------------------------------------
# The JSON to paste into central's nodes.json. Fields align with central/config.go.
ns_central_json() {
	ns_load
	local port="${NODESPEED_LISTEN##*:}"
	case "${NS_SSL_TYPE:-}" in
		domain|path) printf '{ "ip": "%s", "port": %s, "host": "%s", "secret": "%s" }' "$NS_PUBLIC_IP" "$port" "$NS_SITE" "$NODESPEED_SECRET" ;;
		ip)          printf '{ "ip": "%s", "port": %s, "secret": "%s" }' "$NS_PUBLIC_IP" "$port" "$NODESPEED_SECRET" ;;
		http)        printf '{ "ip": "%s", "port": %s, "scheme": "http", "secret": "%s" }' "$NS_PUBLIC_IP" "$port" "$NODESPEED_SECRET" ;;
		*)           printf '{ "ip": "%s", "port": %s, "secret": "%s" }' "${NS_PUBLIC_IP:-<公网IP>}" "$port" "${NODESPEED_SECRET:-}" ;;
	esac
}

# Print the paste block + the sync reminder. Call after any port/TLS/secret change.
ns_print_central() {
	HR
	LOGI "把下面这条粘进 central 的 nodes.json → \"nodes\": [ ... ] 里:"
	echo
	printf '    %s\n' "$(ns_central_json)"
	echo
	LOGW "站点/端口/密钥若有变动,务必回 central 同步这一条,否则中心侧连不上该节点。"
	HR
}

# ---- interactive SSL setup (shared by install & menu) ------------------------
# Prompts for one of the 4 cert modes, performs it, and persists the result to
# $NS_CONF. Requires NS_PUBLIC_IP already stored. Returns 0 on success.
# Policy: for the ACME modes we only *check* whether port 80 is free and warn —
# we NEVER touch the firewall (left to the cloud security group / the operator).
ns_setup_ssl() {
	ns_load
	local pubip="${NS_PUBLIC_IP:-$(ns_public_ip || echo '')}"
	echo
	echo "  选择 SSL 证书获取方式:"
	echo "    1) ACME 域名证书   (需域名解析到本机 + 开放 80 端口)"
	echo "    2) ACME IP 证书    (Let's Encrypt 6 天短证书,需开放 80 端口)"
	echo "    3) 填写现成证书路径 (已有 fullchain + private key)"
	echo "    4) HTTP 明文模式   (不加密;中心面板也必须用 http)"
	local c; read -rp "  输入 [1-4]: " c
	case "$c" in
		1)
			local d hp
			read -rp "  域名 (如 hk1.example.com): " d
			[ -n "$d" ] || { LOGE "域名不能为空"; return 1; }
			read -rp "  HTTP-01 验证端口 [80]: " hp; hp="${hp:-80}"
			ns_port_used "$hp" && LOGW "端口 $hp 已被占用,acme 签发可能失败(脚本不会改防火墙,请自行放行/腾出)。"
			ns_issue_cert "$d" "$hp" 0 || { LOGE "证书签发失败"; return 1; }
			ns_set NODESPEED_TLS_MODE cert
			ns_set NODESPEED_CERT "$NS_CERT_INSTALLED"
			ns_set NODESPEED_KEY  "$NS_KEY_INSTALLED"
			ns_set NS_SSL_TYPE domain
			ns_set NS_SITE "$d"
			;;
		2)
			[ -n "$pubip" ] || { LOGE "拿不到公网 IP,无法签 IP 证书"; return 1; }
			local hp
			LOGI "将为本机公网 IP $pubip 申请证书。"
			read -rp "  HTTP-01 验证端口 [80]: " hp; hp="${hp:-80}"
			ns_port_used "$hp" && LOGW "端口 $hp 已被占用,acme 签发可能失败(脚本不会改防火墙,请自行放行/腾出)。"
			ns_issue_cert "$pubip" "$hp" 1 || { LOGE "IP 证书签发失败"; return 1; }
			ns_set NODESPEED_TLS_MODE cert
			ns_set NODESPEED_CERT "$NS_CERT_INSTALLED"
			ns_set NODESPEED_KEY  "$NS_KEY_INSTALLED"
			ns_set NS_SSL_TYPE ip
			ns_set NS_SITE "$pubip"
			;;
		3)
			local cf kf site
			read -rp "  fullchain 证书路径: " cf
			read -rp "  private key 路径: " kf
			[ -r "$cf" ] && [ -r "$kf" ] || { LOGE "证书或私钥不可读"; return 1; }
			read -rp "  该证书对应的域名或 IP (中心端用) [${pubip}]: " site; site="${site:-$pubip}"
			ns_set NODESPEED_TLS_MODE cert
			ns_set NODESPEED_CERT "$cf"
			ns_set NODESPEED_KEY  "$kf"
			ns_set NS_SSL_TYPE path
			ns_set NS_SITE "$site"
			;;
		4)
			LOGW "HTTP 模式无加密。中心面板(central)也必须以 http 提供,否则浏览器混合内容会拦截测速。"
			ns_set NODESPEED_TLS_MODE http
			ns_set NODESPEED_CERT ""
			ns_set NODESPEED_KEY  ""
			ns_set NS_SSL_TYPE http
			ns_set NS_SITE "$pubip"
			;;
		*) LOGE "无效选择"; return 1 ;;
	esac
	return 0
}
