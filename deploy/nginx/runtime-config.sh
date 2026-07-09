#!/bin/sh
set -eu

config_file="/usr/share/nginx/html/config.js"

json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > "$config_file" <<EOF
window.__SKEDRA_CONFIG__ = {
  API_URL: "$(json_escape "${SKEDRA_PUBLIC_FRONTEND_API_URL:-}")",
  APP_URL: "$(json_escape "${SKEDRA_PUBLIC_APP_URL:-}")",
  LIBRARIES_URL: "$(json_escape "${SKEDRA_PUBLIC_LIBRARIES_URL:-}")",
  REALTIME_URL: "$(json_escape "${SKEDRA_PUBLIC_FRONTEND_REALTIME_URL:-}")"
};
EOF
