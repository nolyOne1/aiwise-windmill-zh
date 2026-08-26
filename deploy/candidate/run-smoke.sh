#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${CANDIDATE_IMAGE:?set the locally built candidate image}"
export CANDIDATE_DB_PASSWORD
CANDIDATE_DB_PASSWORD="$(openssl rand -hex 24)"
if [[ ${GITHUB_ACTIONS:-} == true ]]; then
    echo "::add-mask::$CANDIDATE_DB_PASSWORD"
fi
project="zh-auth-test-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
compose=(docker compose --project-name "$project" --file deploy/candidate/compose.test.yml)
cleanup() {
    local result=$?
    trap - EXIT
    if (( result != 0 )); then
        {
            echo 'Isolated test container state:'
            "${compose[@]}" ps --all || true
            local server_id
            server_id="$("${compose[@]}" ps --all --quiet server)"
            if [[ -n "$server_id" ]]; then
                docker inspect --format '{{json .State}}' "$server_id" || true
            fi
            echo 'Isolated test startup logs:'
            "${compose[@]}" logs --no-color --tail 200 || true
            echo 'Version probe from inside the server container:'
            "${compose[@]}" exec -T server curl --silent --show-error --max-time 5 \
                --write-out '\nHTTP %{http_code}\n' http://127.0.0.1:8000/api/version || true
        } 2>&1 | node deploy/candidate/redact-diagnostics.mjs || true
    fi
    "${compose[@]}" down --remove-orphans >/dev/null || result=1
    exit "$result"
}
trap cleanup EXIT

code=0
docker run --rm -e NO_AUTH=true "$CANDIDATE_IMAGE" windmill --help >/dev/null 2>&1 || code=$?
test "$code" -eq 64
code=0
docker run --rm "$CANDIDATE_IMAGE" windmill --no-auth --help >/dev/null 2>&1 || code=$?
test "$code" -eq 64

"${compose[@]}" up --detach
node deploy/candidate/smoke-auth.mjs
