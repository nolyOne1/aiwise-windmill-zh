# Immutable candidate acceptance

This directory accepts only the already-verified immutable image
`ghcr.io/nolyone1/aiwise-windmill-zh@sha256:938a97c890ad3e8f7f69ffaa60ce613c504721b0a5a30c8f7e75b9b82ea7334a`.
It never builds, publishes, tags, deploys, or exposes a port for that image.

`run.sh` creates a unique Compose project with an internal-only network and a
temporary PostgreSQL data directory. It rejects external base URL and database
settings, generates the database password itself, runs authentication, worker,
and browser checks, and removes every service and volume on every exit path.
The browser and worker test containers do not receive a Docker socket.

The worker fixture uses only Python standard-library arithmetic. The candidate
Dockerfile preinstalls its managed Python runtimes, so the test deliberately
does not give a worker public-network access for dependency bootstrap. It checks
a manual job, preserved raw log text, a deliberate failure, and an actual UTC
scheduled job before disabling it. The temporary database is discarded with its
entire Compose project after the browser check, which cleans every fixture.

The browser test starts with empty state and uses the rendered user settings
language control; it does not modify local storage or inject translations. It
keeps a masked failure screenshot and a bounded status/path text report in
`results/test-results/`; successful runs have no browser screenshots. Traces,
video, HAR files, authentication storage, credentials, and browser recordings
are not artifacts.

The unprivileged worker requests PID-namespace isolation with
`FAVOR_UNSHARE_PID=true`. If `unshare` is unavailable, Windmill logs that jobs
run without inner job isolation; the internal Compose network and temporary
database remain test infrastructure isolation, not a replacement process
sandbox.

## Local static checks

```bash
bash -n deploy/acceptance/run.sh deploy/acceptance/test-runner.sh
bash deploy/acceptance/test-runner.sh
node frontend/node_modules/@playwright/test/cli.js test --config deploy/acceptance/playwright.config.ts --list
```

The Playwright list command needs `CANDIDATE_ACCEPTANCE=1` and the internal
Docker URL because the config refuses accidental host execution. Full acceptance
requires Linux Docker and runs in the scoped GitHub Actions workflow.
