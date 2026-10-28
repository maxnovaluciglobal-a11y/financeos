#!/usr/bin/env bash
# Runs every SQL test in supabase/tests/ against the test database (start.sh + apply-migrations.sh).
# A file passes when psql exits 0 under ON_ERROR_STOP. To stop a test that checks nothing from
# passing in silence, each file must (a) end its work with ROLLBACK and (b) contain a check
# (an `assert` or a `raise exception`).
set -uo pipefail
NAME="${TEST_DB_NAME:-moyiq-test-db}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="$HERE/../../supabase/tests"
fail=0; n=0
for f in "$DIR"/*.sql; do
  b=$(basename "$f")
  case "$b" in acl_catalog.sql) continue ;; esac
  n=$((n + 1))
  if ! grep -qiE '^\s*rollback' "$f"; then echo "FAIL $b: no ROLLBACK (a test must leave no rows)"; fail=1; continue; fi
  if ! grep -qiE '\bassert\b|raise exception' "$f"; then echo "FAIL $b: no assert / raise exception (it would pass without checking anything)"; fail=1; continue; fi
  if out=$(docker exec -i "$NAME" psql -X -q -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$f" 2>&1); then
    echo "ok   $b"
  else
    echo "FAIL $b"; echo "$out" | grep -E "ERROR|DETAIL|CONTEXT" | head -5; fail=1
  fi
done
echo "$n sql test files, failures: $fail"
exit $fail
