#!/bin/sh
set -eu

config_file="/usr/share/nginx/html/config.js"
client_ip_map_file="/etc/nginx/conf.d/00-skedra-client-ip.conf"

json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > "$config_file" <<EOF
window.__SKEDRA_CONFIG__ = {
  API_URL: "$(json_escape "${SKEDRA_PUBLIC_FRONTEND_API_URL:-}")",
  APP_URL: "$(json_escape "${SKEDRA_PUBLIC_APP_URL:-}")",
  LIBRARIES_URL: "$(json_escape "${SKEDRA_PUBLIC_LIBRARIES_URL:-}")"
};
EOF

# Keep the default safe for directly exposed/self-hosted nginx. Managed
# deployments may explicitly trust the header that their immediate, private
# tunnel proxy overwrites. The generated nginx variable is then forwarded to
# the API as X-Real-IP; arbitrary X-Forwarded-For input is never selected.
case "${SKEDRA_TRUSTED_CLIENT_IP_HEADER:-direct}" in
	direct)
		cat > "$client_ip_map_file" <<'EOF'
map $remote_addr $skedra_client_ip {
  default $remote_addr;
}
EOF
		;;
	cf-connecting-ip)
		cat > "$client_ip_map_file" <<'EOF'
map $http_cf_connecting_ip $skedra_client_ip {
  "" $remote_addr;
  default $http_cf_connecting_ip;
}
EOF
		;;
	x-real-ip)
		cat > "$client_ip_map_file" <<'EOF'
map $http_x_real_ip $skedra_client_ip {
  "" $remote_addr;
  default $http_x_real_ip;
}
EOF
		;;
	*)
		echo >&2 "Invalid SKEDRA_TRUSTED_CLIENT_IP_HEADER: expected direct, cf-connecting-ip, or x-real-ip"
		exit 1
		;;
esac
