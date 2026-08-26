#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export CANDIDATE_IMAGE=fixture-candidate
docker() {
    case "$*" in
        'run '*) return 64 ;;
        *'ps --all --quiet server'*) echo fixture-server ;;
        *'ps --all'*) echo 'fixture-server Exited (1)' ;;
        'inspect '*) echo '{"ExitCode":1,"OOMKilled":false}' ;;
        *'logs --no-color --tail 200'*)
            echo "startup failed postgres://postgres:$CANDIDATE_DB_PASSWORD@db/windmill"
            echo "password=$CANDIDATE_DB_PASSWORD"
            ;;
        *'exec -T server curl'*) echo 'HTTP 000'; return 7 ;;
        *'exec -T --env CANDIDATE_SMOKE_TEST=1 server node --input-type=module'*) return 23 ;;
        *'down --remove-orphans'*) echo 'cleanup called' >&2 ;;
        *'up --detach'*) return 0 ;;
        *) return 99 ;;
    esac
}
node() {
    if [[ $1 == deploy/candidate/smoke-auth.mjs ]]; then
        return 99
    fi
    command node "$@"
}
export -f docker node
result=0
output="$(bash deploy/candidate/run-smoke.sh 2>&1)" || result=$?
test "$result" -eq 23
[[ "$output" == *'"ExitCode":1'* ]]
[[ "$output" == *'startup failed postgres://[REDACTED]@db/windmill'* ]]
[[ "$output" == *'password=[REDACTED]'* ]]
[[ "$output" == *'HTTP 000'* ]]
[[ "$output" == *'cleanup called'* ]]
echo 'Failure diagnostics, redaction, cleanup and original exit status passed'
