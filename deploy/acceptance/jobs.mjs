import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

assert.equal(
  process.env.CANDIDATE_ACCEPTANCE,
  "1",
  "Run acceptance jobs only through deploy/acceptance/run.sh",
);
const base = process.env.ACCEPTANCE_BASE_URL;
assert.equal(
  base,
  "http://server:8000",
  "Acceptance jobs require the internal server URL",
);

const workspace = "admins";
const paths = {
  inventory: "u/admin/acceptance_inventory",
  failure: "u/admin/acceptance_failure",
  schedule: "u/admin/acceptance_inventory_schedule",
};
let token;

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.text();
  assert.ok(
    response.ok,
    `${options.method || "GET"} ${path} returned ${response.status}: ${body.slice(0, 400)}`,
  );
  return body;
}

async function login() {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@windmill.dev", password: "changeme" }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200, "isolated default account login failed");
  token = (await response.text()).trim();
  assert.ok(token.length > 16, "isolated login did not return a session token");
}

async function createScript(path, content) {
  await request(`/api/w/${workspace}/scripts/create`, {
    method: "POST",
    body: JSON.stringify({
      path,
      summary: "Isolated candidate acceptance fixture",
      content,
      language: "python3",
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {},
      },
    }),
  });
}

async function run(path) {
  return (
    await request(`/api/w/${workspace}/jobs/run/p/${path}`, {
      method: "POST",
      body: "{}",
    })
  ).trim();
}

async function completed(id, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${base}/api/w/${workspace}/jobs_u/completed/get_result_maybe/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (response.ok) {
      last = await response.json();
      if (last.completed) return last;
    }
    await delay(1_000);
  }
  throw new Error(`job ${id} did not complete: ${JSON.stringify(last)}`);
}

async function logs(id) {
  return request(`/api/w/${workspace}/jobs_u/get_logs/${id}`);
}

async function scheduledRun() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const schedules = JSON.parse(
      await request(
        `/api/w/${workspace}/schedules/list_with_jobs?per_page=100`,
      ),
    );
    const schedule = schedules.find((entry) => entry.path === paths.schedule);
    const job = schedule?.jobs?.[0];
    if (job?.id) return job.id;
    await delay(1_000);
  }
  throw new Error(
    "enabled schedule did not produce a completed run before timeout",
  );
}

await login();
{
  await createScript(
    paths.inventory,
    `#py: 3.11.0\ndef main():\n    quantity = 3 + 4\n    print(f"RAW_LOG inventory sku=DEMO-001 qty={quantity}")\n    return {"sku": "DEMO-001", "qty": quantity}\n`,
  );
  await createScript(
    paths.failure,
    `#py: 3.11.0\ndef main():\n    raise RuntimeError("intentional acceptance failure")\n`,
  );

  const manualId = await run(paths.inventory);
  const manual = await completed(manualId);
  assert.equal(
    manual.success,
    true,
    `manual inventory job failed: ${JSON.stringify(manual)}`,
  );
  assert.deepEqual(manual.result, { sku: "DEMO-001", qty: 7 });
  assert.match(await logs(manualId), /RAW_LOG inventory sku=DEMO-001 qty=7/);

  const failureId = await run(paths.failure);
  const failure = await completed(failureId);
  assert.equal(
    failure.success,
    false,
    "intentional failure was not preserved as failed",
  );
  assert.match(
    JSON.stringify(failure.result),
    /intentional acceptance failure/,
  );

  await request(`/api/w/${workspace}/schedules/create`, {
    method: "POST",
    body: JSON.stringify({
      path: paths.schedule,
      schedule: "*/15 * * * * *",
      timezone: "UTC",
      script_path: paths.inventory,
      is_flow: false,
      args: {},
      enabled: true,
    }),
  });
  const scheduleId = await scheduledRun();
  const scheduled = await completed(scheduleId);
  assert.equal(scheduled.success, true, "scheduled inventory job failed");
  assert.deepEqual(scheduled.result, { sku: "DEMO-001", qty: 7 });
  assert.match(await logs(scheduleId), /RAW_LOG inventory sku=DEMO-001 qty=7/);
  await request(`/api/w/${workspace}/schedules/setenabled/${paths.schedule}`, {
    method: "POST",
    body: JSON.stringify({ enabled: false }),
  });
  const schedule = JSON.parse(
    await request(`/api/w/${workspace}/schedules/get/${paths.schedule}`),
  );
  assert.equal(schedule.enabled, false, "schedule did not remain disabled");
  console.log(
    "PASS: manual, failure, logs, enabled schedule, disabled schedule",
  );
}
