#!/usr/bin/env bash
# nsp — NodeSpeed node management menu (installed to /usr/bin/nsp).
# Manages the node-agent's port, SSL config, and shows the config to paste into
# central. No version/update feature by design.
set -uo pipefail

# Load the shared lib (installed by install.sh; fall back to repo copy for dev).
if [ -r /usr/local/lib/nodespeed/nodespeed-lib.sh ]; then
	# shellcheck source=/dev/null
	. /usr/local/lib/nodespeed/nodespeed-lib.sh
elif [ -r "$(dirname "${BASH_SOURCE[0]:-$0}")/nodespeed-lib.sh" ]; then
	# shellcheck source=/dev/null
	. "$(dirname "${BASH_SOURCE[0]:-$0}")/nodespeed-lib.sh"
else
	echo "找不到 nodespeed-lib.sh,请重新运行安装脚本。" >&2; exit 1
fi

require_root

pause() { read -rp $'\n回车返回菜单...' _; }
confirm() { local a; read -rp "$1 [y/N]: " a; [[ "$a" =~ ^[Yy]$ ]]; }

svc() { systemctl "$1" "$NS_SVC"; }

banner() {
	ns_load
	local act ena
	act="$(ns_is_active)"; ena="$(ns_is_enabled)"
	[ "$act" = active ] && act="$(_c '0;32')运行中$(_c 0)" || act="$(_c '0;31')${act:-未安装}$(_c 0)"
	HR
	printf "  NodeSpeed 节点管理  (nsp)\n"
	HR
	printf "  node-id   : %s\n" "${NODESPEED_NODE_ID:-?}"
	printf "  运行状态  : %b   开机自启: %s\n" "$act" "${ena:-?}"
	printf "  监听端口  : %s        TLS 模式: %s\n" "${NODESPEED_LISTEN##*:}" "${NODESPEED_TLS_MODE:-?}"
	printf "  证书到期  : %s\n" "$(ns_cert_expiry)"
	printf "  站点/公网 : %s  /  %s\n" "${NS_SITE:-?}" "${NS_PUBLIC_IP:-?}"
	HR
}

apply_and_report() {   # restart + self-test + reprint central block
	ns_write_unit; svc restart; sleep 1
	if ns_selftest; then LOGI "自检通过。"; else LOGW "自检未通过,查看日志排查。"; fi
	ns_print_central
}

change_port() {
	ns_load
	local port
	read -rp "新的测速端口 [${NODESPEED_LISTEN##*:}]: " port
	port="${port:-${NODESPEED_LISTEN##*:}}"
	[[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || { LOGE "端口无效"; return; }
	if [ ":$port" != "$NODESPEED_LISTEN" ] && ns_port_used "$port"; then
		LOGW "端口 $port 已被占用。"; confirm "仍然使用?" || return
	fi
	ns_set NODESPEED_LISTEN ":$port"
	LOGI "端口已改为 $port。"
	apply_and_report
}

ssl_menu() {
	while :; do
		ns_load
		echo; HR
		echo "  SSL / 证书  (当前: ${NS_SSL_TYPE:-?} / ${NODESPEED_TLS_MODE:-?})"
		HR
		echo "   1) 切换/重新配置证书 (域名 / IP / 路径 / http)"
		echo "   2) 强制续期 (仅 acme 域名/IP)"
		echo "   3) 查看当前证书"
		echo "   0) 返回"
		local c; read -rp "  选择: " c
		case "$c" in
			1) ns_setup_ssl && apply_and_report; pause ;;
			2)
				ns_load
				if [ "${NS_SSL_TYPE:-}" = domain ] || [ "${NS_SSL_TYPE:-}" = ip ]; then
					"$ACME" --renew -d "$NS_SITE" --force $( [ "${NS_SSL_TYPE}" = ip ] && echo '--ecc' ) 2>&1 | tail -n 20 || true
					svc restart; LOGI "已尝试续期并重启。"
				else
					LOGW "当前不是 acme 证书,无法续期。"
				fi
				pause ;;
			3)
				ns_load
				if [ "${NODESPEED_TLS_MODE:-}" = cert ] && [ -f "${NODESPEED_CERT:-/nonexistent}" ]; then
					openssl x509 -in "$NODESPEED_CERT" -noout -subject -issuer -dates 2>/dev/null || LOGE "读取证书失败"
				else
					LOGW "当前为 ${NODESPEED_TLS_MODE:-?} 模式,无证书文件。"
				fi
				pause ;;
			0) return ;;
			*) : ;;
		esac
	done
}

view_config() {
	ns_load
	echo; HR
	echo "  当前配置"
	HR
	printf "  node-id       : %s\n" "${NODESPEED_NODE_ID:-?}"
	printf "  监听          : %s\n" "${NODESPEED_LISTEN:-?}"
	printf "  TLS 模式      : %s\n" "${NODESPEED_TLS_MODE:-?}"
	printf "  证书          : %s\n" "${NODESPEED_CERT:-（无）}"
	printf "  私钥          : %s\n" "${NODESPEED_KEY:-（无）}"
	printf "  证书到期      : %s\n" "$(ns_cert_expiry)"
	printf "  allow-origin  : %s\n" "${NODESPEED_ALLOW_ORIGIN:-*}"
	printf "  站点 / 公网IP : %s  /  %s\n" "${NS_SITE:-?}" "${NS_PUBLIC_IP:-?}"
	# secret masked by default
	local s="${NODESPEED_SECRET:-}"
	printf "  鉴权 secret   : %s****%s\n" "${s:0:4}" "${s: -4}"
	if confirm "显示 secret 明文?"; then printf "  secret 明文   : %s\n" "$s"; fi
	echo
	if ns_selftest; then LOGI "自检:/__ack 200 正常。"; else LOGW "自检未通过。"; fi
	ns_print_central
	pause
}

rotate_secret() {
	LOGW "轮换 secret 后,central 里该节点的 secret 也必须同步更新,否则鉴权全部失败。"
	confirm "确认轮换?" || return
	ns_set NODESPEED_SECRET "$(ns_gen_secret)"
	LOGI "secret 已更新。"
	apply_and_report
	pause
}

uninstall() {
	confirm "确认卸载 nodespeed 节点?" || return
	svc disable >/dev/null 2>&1; svc stop >/dev/null 2>&1
	rm -f "$NS_UNIT"; systemctl daemon-reload
	rm -f "$NS_BIN" "$NS_MENUDST" "$NS_LIBDST"
	if confirm "同时删除配置与证书 ($NS_DIR)?"; then rm -rf "$NS_DIR"; fi
	LOGI "已卸载。"
	exit 0
}

menu() {
	while :; do
		clear 2>/dev/null || true
		banner
		echo "   1) 启动        2) 停止        3) 重启"
		echo "   4) 查看状态    5) 查看日志    6) 开机自启开关"
		echo "   7) 改测速端口"
		echo "   8) SSL / 证书配置"
		echo "   9) 查看配置 (含中心端粘贴块)"
		echo "  10) 轮换 secret"
		echo "  11) 卸载"
		echo "   0) 退出"
		local c; read -rp "选择: " c
		case "$c" in
			1) svc start; pause ;;
			2) svc stop; pause ;;
			3) svc restart; pause ;;
			4) svc status --no-pager 2>&1 | head -n 20; pause ;;
			5) LOGI "Ctrl-C 退出日志"; journalctl -u "$NS_SVC" -n 80 -f ;;
			6) if [ "$(ns_is_enabled)" = enabled ]; then svc disable && LOGI "已关闭自启"; else svc enable && LOGI "已开启自启"; fi; pause ;;
			7) change_port; pause ;;
			8) ssl_menu ;;
			9) view_config ;;
			10) rotate_secret ;;
			11) uninstall ;;
			0) exit 0 ;;
			*) : ;;
		esac
	done
}
menu
