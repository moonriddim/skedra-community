#!/bin/sh
set -eu

DATA_DIR="${SKEDRA_DATA_DIR:-/data}"
SECRETS_FILE="${SKEDRA_SECRETS_FILE:-$DATA_DIR/secrets.env}"
PGDATA="${POSTGRES_DATA:-$DATA_DIR/postgres}"

mkdir -p "$DATA_DIR"

if [ -f "$SECRETS_FILE" ]; then
	# shellcheck disable=SC1090
	. "$SECRETS_FILE"
fi

random_hex() {
	node -e "console.log(require('node:crypto').randomBytes(Number(process.argv[1])).toString('hex'))" "$1"
}

: "${POSTGRES_DB:=skedra}"
: "${POSTGRES_USER:=skedra}"
: "${POSTGRES_PASSWORD:=$(random_hex 24)}"
: "${SKEDRA_AUTH_SECRET:=${AUTH_SECRET:-$(random_hex 48)}}"
: "${SKEDRA_DATA_ENCRYPTION_SECRET:=${DATA_ENCRYPTION_SECRET:-$(random_hex 48)}}"

cat > "$SECRETS_FILE" <<EOF
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
SKEDRA_AUTH_SECRET=$SKEDRA_AUTH_SECRET
SKEDRA_DATA_ENCRYPTION_SECRET=$SKEDRA_DATA_ENCRYPTION_SECRET
EOF
chmod 600 "$SECRETS_FILE"

: "${SKEDRA_PUBLIC_APP_URL:=http://localhost:3000}"
: "${SKEDRA_PUBLIC_LIBRARIES_URL:=$SKEDRA_PUBLIC_APP_URL/libraries}"
: "${SKEDRA_PUBLIC_API_URL:=$SKEDRA_PUBLIC_APP_URL}"
: "${SKEDRA_MCP_INTERNAL_API_URL:=http://127.0.0.1:3001/api/v1}"
: "${SKEDRA_DEPLOYMENT_MODE:=selfhost}"
: "${SKEDRA_REGISTRATION_MODE:=invite}"
: "${SKEDRA_LIBRARY_CATALOG_MODE:=remote}"
: "${SKEDRA_LIBRARY_CATALOG_API_URL:=https://libraries.skedra.xyz}"
: "${SKEDRA_LIBRARY_SUBMIT_URL:=https://skedra.xyz/login?redirect=%2Flibrary}"
: "${SKEDRA_RUN_MIGRATIONS:=true}"

export DATABASE_URL="${DATABASE_URL:-postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5432/$POSTGRES_DB}"
export AUTH_SECRET="$SKEDRA_AUTH_SECRET"
export DATA_ENCRYPTION_SECRET="$SKEDRA_DATA_ENCRYPTION_SECRET"
export APP_URL="$SKEDRA_PUBLIC_APP_URL"
export API_URL="$SKEDRA_PUBLIC_API_URL"
export MCP_INTERNAL_API_URL="$SKEDRA_MCP_INTERNAL_API_URL"
export LIBRARIES_URL="$SKEDRA_PUBLIC_LIBRARIES_URL"
export SKEDRA_DEPLOYMENT_MODE
export SKEDRA_REGISTRATION_MODE
export SKEDRA_LIBRARY_CATALOG_MODE
export SKEDRA_LIBRARY_CATALOG_API_URL
export SKEDRA_LIBRARY_SUBMIT_URL

write_config() {
	config_file="$1"
	cat > "$config_file" <<EOF
window.__SKEDRA_CONFIG__ = {
  API_URL: "${SKEDRA_PUBLIC_FRONTEND_API_URL:-}",
  APP_URL: "$SKEDRA_PUBLIC_APP_URL",
  LIBRARIES_URL: "$SKEDRA_PUBLIC_LIBRARIES_URL"
};
EOF
}

write_config /usr/share/skedra/web/config.js
write_config /usr/share/skedra/libraries/config.js

mkdir -p "$PGDATA" /run/postgresql /run/nginx
chown -R postgres:postgres "$DATA_DIR" /run/postgresql

if [ ! -s "$PGDATA/PG_VERSION" ]; then
	echo "[skedra] Initializing embedded PostgreSQL database."
	pwfile="$(mktemp)"
	printf '%s' "$POSTGRES_PASSWORD" > "$pwfile"
	chmod 600 "$pwfile"
	chown postgres:postgres "$pwfile"
	su-exec postgres initdb -D "$PGDATA" --username="$POSTGRES_USER" --pwfile="$pwfile" --encoding=UTF8 --locale=C
	rm -f "$pwfile"
	echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
	echo "host all all 127.0.0.1/32 scram-sha-256" >> "$PGDATA/pg_hba.conf"
fi

su-exec postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses=127.0.0.1 -c port=5432" -w start

export PGPASSWORD="$POSTGRES_PASSWORD"
if ! psql -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -tAc "select 1 from pg_database where datname = '$POSTGRES_DB'" | grep -q 1; then
	echo "[skedra] Creating database $POSTGRES_DB."
	createdb -h 127.0.0.1 -U "$POSTGRES_USER" "$POSTGRES_DB"
fi

if [ "$SKEDRA_RUN_MIGRATIONS" != "false" ] && [ "$SKEDRA_RUN_MIGRATIONS" != "0" ]; then
	echo "[skedra] Running database migrations."
	if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAc "select to_regclass('public.users')" | grep -q users; then
		echo "[skedra] Base schema already exists; applying incremental migrations."
	else
		psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/api/schema.sql
	fi
	psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/api/selfhost-migrations.sql
fi

node /app/api/index.cjs &
api_pid="$!"
nginx -g "daemon off;" &
nginx_pid="$!"

shutdown() {
	kill "$api_pid" "$nginx_pid" 2>/dev/null || true
	su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop 2>/dev/null || true
}
trap shutdown INT TERM

while true; do
	for pid in "$api_pid" "$nginx_pid"; do
		if ! kill -0 "$pid" 2>/dev/null; then
			shutdown
			exit 1
		fi
	done
	sleep 2
done
