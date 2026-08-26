#!/bin/sh
set -eu

case "${NO_AUTH:-false}" in
    false|0|'') ;;
    *) echo 'This candidate requires authentication; NO_AUTH is forbidden.' >&2; exit 64 ;;
esac
for arg in "$@"; do
    case "$arg" in
        --no-auth|--no-auth=*)
            echo 'This candidate forbids --no-auth.' >&2
            exit 64
            ;;
    esac
done
export NO_AUTH=false
exec "$@"
