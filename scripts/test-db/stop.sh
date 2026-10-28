#!/usr/bin/env bash
docker rm -f "${TEST_DB_NAME:-moyiq-test-db}" >/dev/null 2>&1 || true
