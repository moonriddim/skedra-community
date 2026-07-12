#!/bin/sh
set -eu

if [ "${SKEDRA_RUN_MIGRATIONS:-true}" = "false" ] || [ "${SKEDRA_RUN_MIGRATIONS:-true}" = "0" ]; then
	exec node index.cjs
fi

if [ -z "${DATABASE_URL:-}" ]; then
	echo "[skedra] DATABASE_URL is required." >&2
	exit 1
fi

echo "[skedra] Running database migrations."

if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAc "select to_regclass('public.users')" | grep -q users; then
	echo "[skedra] Base schema already exists; applying incremental migrations."
else
	psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/schema.sql
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/selfhost-migrations.sql

echo "[skedra] Database migrations complete."
exec node index.cjs
