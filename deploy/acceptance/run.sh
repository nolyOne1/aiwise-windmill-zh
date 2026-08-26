#!/usr/bin/env bash
set -euo pipefail

if [[ ${CANDIDATE_ACCEPTANCE:-} != 1 ]]; then
    echo 'Refusing to run without CANDIDATE_ACCEPTANCE=1.' >&2
    exit 64
fi
if [[ -n ${ACCEPTANCE_BASE_URL:-} || -n ${DATABASE_URL:-} || -n ${CANDIDATE_ACCEPTANCE_DB_PASSWORD:-} ]]; then
    echo 'Refusing external URL or database configuration.' >&2
    exit 64
fi

cd "$(dirname "$0")/../.."
readonly candidate_image='ghcr.io/nolyone1/aiwise-windmill-zh@sha256:938a97c890ad3e8f7f69ffaa60ce613c504721b0a5a30c8f7e75b9b82ea7334a'
export CANDIDATE_ACCEPTANCE_DB_PASSWORD
CANDIDATE_ACCEPTANCE_DB_PASSWORD="$(openssl rand -hex 24)"
if [[ ${GITHUB_ACTIONS:-} == true ]]; then
    echo "::add-mask::$CANDIDATE_ACCEPTANCE_DB_PASSWORD"
fi
project="candidate-acceptance-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
compose=(docker compose --project-name "$project" --file deploy/acceptance/compose.yml)

diagnostics() {
    {
        echo 'Isolated acceptance container state:'
        "${compose[@]}" ps --all || true
        echo 'Isolated acceptance startup logs:'
        "${compose[@]}" logs --no-color --tail 200 || true
        echo 'Version probe from inside the server container:'
        "${compose[@]}" exec -T server curl --silent --show-error --max-time 5 \
            --write-out '\nHTTP %{http_code}\n' http://127.0.0.1:8000/api/version || true
    } 2>&1 | CANDIDATE_DB_PASSWORD="$CANDIDATE_ACCEPTANCE_DB_PASSWORD" \
        node deploy/candidate/redact-diagnostics.mjs || true
}

cleanup() {
    local result=$?
    trap - EXIT INT TERM
    if (( result != 0 )); then diagnostics; fi
    "${compose[@]}" down --remove-orphans --volumes >/dev/null || result=1
    exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker pull "$candidate_image"
docker pull postgres:16
docker pull mcr.microsoft.com/playwright:v1.57.0-noble
"${compose[@]}" up --detach db server worker
"${compose[@]}" exec -T --env CANDIDATE_SMOKE_TEST=1 server node --input-type=module < deploy/candidate/smoke-auth.mjs

set +e
"${compose[@]}" run --rm jobs
jobs_status=$?
"${compose[@]}" run --rm browser
browser_status=$?
set -e
if (( jobs_status != 0 || browser_status != 0 )); then
    echo "Acceptance checks failed: jobs=$jobs_status browser=$browser_status" >&2
    exit 1
fi
echo 'PASS: isolated candidate acceptance completed'
