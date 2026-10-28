#!/usr/bin/env bash
# Starts a throwaway Postgres (the same Supabase image production's major version uses),
# WITHOUT network (the migrations schedule pg_cron jobs that call production URLs; the test
# database must never be able to reach them) and applies scripts/test-db/bootstrap.sql.
# The container keeps the platform defaults on purpose: no preseed granting ALL to anon /
# authenticated, so a missing GRANT shows up here the way it would in production.
# IMAGE can be overridden (CI uses ghcr.io/supabase/postgres: the ECR public registry rate-limits shared runners).
#   scripts/test-db/start.sh      -> prints nothing, leaves container `moyiq-test-db` running
set -euo pipefail
NAME="${TEST_DB_NAME:-moyiq-test-db}"
IMAGE="${IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.165}"
HERE="$(cd "$(dirname "$0")" && pwd)"
docker rm -f "$NAME" >/dev/null 2>&1 || true
for attempt in 1 2 3; do docker pull -q "$IMAGE" >/dev/null && break; [ "$attempt" = 3 ] && { echo "cannot pull $IMAGE" >&2; exit 1; }; sleep 15; done
docker run -d --name "$NAME" --network none -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" "$IMAGE" >/dev/null
ready=0
for _ in $(seq 1 90); do
  # The image initialises, restarts once, and only then is the platform schema final.
  started=$(docker logs "$NAME" 2>&1 | grep -c 'database system is ready to accept connections' || true)
  has_uid=$(docker exec "$NAME" psql -X -q -U supabase_admin -d postgres -A -t -c "select to_regprocedure('auth.uid()') is not null" 2>/dev/null || true)
  if [ "${started:-0}" -ge 2 ] && [ "$has_uid" = "t" ]; then ready=1; break; fi
  sleep 2
done
[ "$ready" = 1 ] || { echo "test database did not become ready" >&2; docker logs "$NAME" 2>&1 | tail -5 >&2; exit 1; }
docker exec -i "$NAME" psql -X -q -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$HERE/bootstrap.sql"
