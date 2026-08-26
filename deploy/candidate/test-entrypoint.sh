#!/bin/sh
set -eu
entrypoint="$(dirname "$0")/auth-entrypoint.sh"
NO_AUTH=false sh "$entrypoint" sh -c 'test "$NO_AUTH" = false'
for value in true 1 TRUE unexpected; do
    code=0
    NO_AUTH="$value" sh "$entrypoint" true >/dev/null 2>&1 || code=$?
    test "$code" -eq 64
done
for arg in --no-auth --no-auth=true; do
    code=0
    NO_AUTH=false sh "$entrypoint" true "$arg" >/dev/null 2>&1 || code=$?
    test "$code" -eq 64
done
echo 'Entrypoint auth guards passed'
