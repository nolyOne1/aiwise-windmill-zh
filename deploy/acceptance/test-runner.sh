#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

run="deploy/acceptance/run.sh"
result=0
output="$(env -u CANDIDATE_ACCEPTANCE bash "$run" 2>&1)" || result=$?
test "$result" -eq 64
[[ "$output" == *'Refusing to run without CANDIDATE_ACCEPTANCE=1.'* ]]

result=0
output="$(CANDIDATE_ACCEPTANCE=1 ACCEPTANCE_BASE_URL=http://example.invalid bash "$run" 2>&1)" || result=$?
test "$result" -eq 64
[[ "$output" == *'Refusing external URL or database configuration.'* ]]

grep -Fq 'ghcr.io/nolyone1/aiwise-windmill-zh@sha256:938a97c890ad3e8f7f69ffaa60ce613c504721b0a5a30c8f7e75b9b82ea7334a' deploy/acceptance/compose.yml
grep -Fq 'internal: true' deploy/acceptance/compose.yml

docker() {
    case "$*" in
        pull\ *) return 0 ;;
        *'up --detach db server worker'*) return 0 ;;
        *'exec -T --env CANDIDATE_SMOKE_TEST=1 server node --input-type=module'*) return 0 ;;
        *'run --rm jobs'*) echo 'jobs ran'; return 23 ;;
        *'run --rm browser'*) echo 'browser ran'; return 0 ;;
        *'ps --all'*) echo 'fixture-server Exited (1)' ;;
        *'logs --no-color --tail 200'*) echo "password=$CANDIDATE_ACCEPTANCE_DB_PASSWORD" ;;
        *'exec -T server curl'*) echo 'HTTP 000'; return 7 ;;
        *'down --remove-orphans --volumes'*) echo 'cleanup called' >&2 ;;
        *) return 99 ;;
    esac
}
export -f docker
result=0
output="$(CANDIDATE_ACCEPTANCE=1 bash "$run" 2>&1)" || result=$?
test "$result" -eq 1
[[ "$output" == *'jobs ran'* ]]
[[ "$output" == *'browser ran'* ]]
[[ "$output" == *'cleanup called'* ]]
[[ "$output" == *'password=[REDACTED]'* ]]
echo 'Acceptance runner guards, redaction, failure propagation and cleanup checks passed'
