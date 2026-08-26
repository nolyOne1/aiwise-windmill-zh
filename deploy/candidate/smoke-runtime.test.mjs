import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("smoke refuses accidental execution outside the isolated test runner", () => {
  const env = { ...process.env };
  delete env.CANDIDATE_SMOKE_TEST;
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./smoke-auth.mjs", import.meta.url))],
    { env, encoding: "utf8", timeout: 3000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /only through run-smoke.sh inside the isolated test container/,
  );
});
