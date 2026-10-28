#!/usr/bin/env bash
# Replays supabase/migrations on the test database, in an order that works on an empty one:
#   1. the first migration (the functions production has but no other migration created),
#   2. the baseline tables (20261019185000) - they must exist before the files that use them,
#   3. every other migration in version order,
#   4. the baseline again: its triggers call functions defined by later migrations, so the
#      first pass cannot create them; the file is idempotent.
# Any SQL error in passes 1-3 fails the run (pass 4 is the one that completes the triggers).
set -euo pipefail
NAME="${TEST_DB_NAME:-moyiq-test-db}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../../supabase/migrations"
BASELINE=20261019185000_baseline_handmade_tables.sql
run() { docker exec -i "$NAME" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 -1 < "$1"; }
# Errors that are expected in the first baseline pass only (triggers whose functions come later).
run_tolerant() { docker exec -i "$NAME" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=0 < "$1" >/dev/null 2>&1 || true; }

files=($(cd "$MIG" && ls *.sql | grep -v "^$BASELINE$" | sort))
echo "applying ${files[0]}"; run "$MIG/${files[0]}"
echo "applying $BASELINE (pass 1, tolerant)"; run_tolerant "$MIG/$BASELINE"
for f in "${files[@]:1}"; do echo "applying $f"; run "$MIG/$f"; done
echo "applying $BASELINE (pass 2)"; run "$MIG/$BASELINE"
echo "migrations applied: $(( ${#files[@]} + 1 )) files"
