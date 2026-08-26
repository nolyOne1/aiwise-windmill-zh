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
    "${compose[@]}" down --remove-orphans >/dev/null
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
