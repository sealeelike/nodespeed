#!/usr/bin/env bash
# NodeSpeed node-agent one-shot installer. Run once as root:
#   bash install.sh
# It installs deps, drops the agent binary + systemd unit, walks you through
# node-id / port / SSL, generates the HMAC secret, starts the service, self-tests,
# and prints the config line to paste into central. Afterwards manage with `nsp`.
# NOTE: no `set -u` — on a fresh install the NODESPEED_* config vars are unset
# until we write them, and -u would abort on the first `${NODESPEED_LISTEN...}`.
set -o pipefail

NS_REPO="${NS_REPO:-sealeelike/nodespeed}"
NS_BRANCH="${NS_BRANCH:-main}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# --- locate the shared lib: prefer a copy next to this script (repo checkout),
#     otherwise download it from raw.githubusercontent.com ---
_src_lib="$SELF_DIR/nodespeed-lib.sh"
if [ -r "$_src_lib" ]; then
	# shellcheck source=/dev/null
	. "$_src_lib"
else
	_tmp_lib="$(mktemp)"
	curl -fsS "https://raw.githubusercontent.com/${NS_REPO}/${NS_BRANCH}/scripts/nodespeed-lib.sh" -o "$_tmp_lib" \
		|| { echo "无法获取 nodespeed-lib.sh" >&2; exit 1; }
	# shellcheck source=/dev/null
	. "$_tmp_lib"; _src_lib="$_tmp_lib"
fi

require_root

# --- OS / arch detection ------------------------------------------------------
detect_os() {
	if [ -r /etc/os-release ]; then . /etc/os-release; OS_ID="${ID:-}"; OS_LIKE="${ID_LIKE:-}"; else OS_ID=unknown; OS_LIKE=; fi
}
pkg_family() {
	case "$OS_ID $OS_LIKE" in
		*debian*|*ubuntu*) echo apt ;;
		*rhel*|*fedora*|*centos*|*rocky*|*alma*) command -v dnf >/dev/null 2>&1 && echo dnf || echo yum ;;
		*arch*|*manjaro*) echo pacman ;;
		*alpine*) echo apk ;;
		*) echo unknown ;;
	esac
}
detect_arch() {
	case "$(uname -m)" in
		x86_64|amd64) echo amd64 ;;
		aarch64|arm64) echo arm64 ;;
		armv7l|armv7) echo armv7 ;;
		*) echo amd64 ;;
	esac
}

install_deps() {
	local fam; fam="$(pkg_family)"
	LOGI "安装依赖 (curl tar socat openssl ca-certificates cron),首次可能要十几秒,输出如下 ..."
	case "$fam" in
		apt)    export DEBIAN_FRONTEND=noninteractive; apt-get update -q && apt-get install -y -q curl tar socat openssl ca-certificates cron ;;
		dnf)    dnf install -y curl tar socat openssl ca-certificates cronie ;;
		yum)    yum install -y curl tar socat openssl ca-certificates cronie ;;
		pacman) pacman -Sy --noconfirm --needed curl tar socat openssl ca-certificates cronie ;;
		apk)    apk add --no-cache curl tar socat openssl ca-certificates dcron ;;
		*)      LOGW "未知发行版,请自行确保已装:curl tar socat openssl" ;;
	esac
	LOGI "依赖就绪。"
}

# --- agent binary: local override / repo build first, else GitHub release -----
install_binary() {
	local arch; arch="$(detect_arch)"
	if [ -n "${NODESPEED_AGENT_BIN:-}" ] && [ -x "${NODESPEED_AGENT_BIN}" ]; then
		LOGI "使用本地二进制 ${NODESPEED_AGENT_BIN}"
		install -m 0755 "${NODESPEED_AGENT_BIN}" "$NS_BIN"; return 0
	fi
	for cand in "$SELF_DIR/../node-agent/nodespeed-agent" "$SELF_DIR/../node-agent/node-agent"; do
		if [ -x "$cand" ]; then
			LOGI "使用仓库内已编译二进制 $cand"
			install -m 0755 "$cand" "$NS_BIN"; return 0
		fi
	done
	local url="https://github.com/${NS_REPO}/releases/latest/download/nodespeed-agent-linux-${arch}.tar.gz"
	LOGI "从 GitHub Release 下载 (${arch}) ..."
	local tmp; tmp="$(mktemp -d)"
	if curl -fLR --retry 5 -o "$tmp/a.tar.gz" "$url" 2>/dev/null; then
		tar -xzf "$tmp/a.tar.gz" -C "$tmp"
		local bin; bin="$(find "$tmp" -type f -name 'nodespeed-agent' | head -n1)"
		[ -n "$bin" ] || { LOGE "release 包里找不到 nodespeed-agent"; rm -rf "$tmp"; return 1; }
		install -m 0755 "$bin" "$NS_BIN"; rm -rf "$tmp"; return 0
	fi
	rm -rf "$tmp"
	LOGE "没有可用二进制。请先编译好放到 ./node-agent/nodespeed-agent,或设 NODESPEED_AGENT_BIN=/path 再跑。"
	return 1
}

# --- install the lib + nsp menu to system paths -------------------------------
install_menu() {
	mkdir -p "$(dirname "$NS_LIBDST")"
	install -m 0644 "$_src_lib" "$NS_LIBDST"
	if [ -r "$SELF_DIR/nsp.sh" ]; then
		install -m 0755 "$SELF_DIR/nsp.sh" "$NS_MENUDST"
	else
		curl -fsS "https://raw.githubusercontent.com/${NS_REPO}/${NS_BRANCH}/scripts/nsp.sh" -o "$NS_MENUDST" \
			&& chmod 0755 "$NS_MENUDST" || { LOGE "获取 nsp 菜单失败"; return 1; }
	fi
}

# ==============================================================================
main() {
	detect_os
	install_deps
	install_binary || exit 1
	install_menu   || exit 1
	mkdir -p "$NS_DIR" "$NS_CERT_DIR"; chmod 700 "$NS_DIR"

	HR; LOGI "NodeSpeed 节点安装"; HR
	ns_load

	local defid nid
	defid="$(hostname -s 2>/dev/null || echo node)"
	read -rp "节点标识 node-id [${NODESPEED_NODE_ID:-$defid}]: " nid
	nid="${nid:-${NODESPEED_NODE_ID:-$defid}}"

	local port
	while :; do
		read -rp "测速服务端口 [${NODESPEED_LISTEN##*:}]: " port
		port="${port:-${NODESPEED_LISTEN##*:}}"; port="${port:-8443}"
		[[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || { LOGE "端口无效"; continue; }
		ns_port_used "$port" && { LOGW "端口 $port 已被占用,换一个。"; continue; }
		break
	done

	# public IP (needed for the central config block)
	local pubip; pubip="$(ns_public_ip || echo '')"
	[ -n "$pubip" ] || read -rp "自动获取公网 IP 失败,请手动输入本机公网 IP: " pubip

	# secret: reuse existing on re-install, else generate
	local secret="${NODESPEED_SECRET:-}"; [ -n "$secret" ] || secret="$(ns_gen_secret)"

	# persist base config
	ns_set NODESPEED_NODE_ID "$nid"
	ns_set NODESPEED_LISTEN ":$port"
	ns_set NODESPEED_SECRET "$secret"
	ns_set NODESPEED_ALLOW_ORIGIN "*"
	ns_set NS_PUBLIC_IP "$pubip"

	ns_setup_ssl || exit 1

	ns_write_unit
	ns_enable_start
	sleep 1

	HR
	if ns_selftest; then LOGI "自检通过:/__ack 返回 200,端点 + TLS 正常。"
	else LOGW "自检未通过。用 'nsp' → 查看日志 排查(证书/端口/防火墙)。"; fi
	ns_print_central
	LOGI "安装完成。以后敲  nsp  打开管理菜单。"
}
main "$@"
