import assert from "node:assert/strict";
import test from "node:test";
import { isRunnableScriptVersion } from "./readiness.mjs";

test("only the returned, locked, error-free script version is runnable", () => {
  assert.equal(
    isRunnableScriptVersion(
      { hash: 42, lock: null, lock_error_logs: null },
      "42",
    ),
    false,
  );
  assert.equal(
    isRunnableScriptVersion(
      { hash: 42, lock: "", lock_error_logs: null },
      "42",
    ),
    true,
  );
  assert.equal(
    isRunnableScriptVersion(
      { hash: 43, lock: "", lock_error_logs: null },
      "42",
    ),
    false,
  );
  assert.equal(
    isRunnableScriptVersion(
      { hash: 42, lock: "", lock_error_logs: "lock failed" },
      "42",
    ),
    false,
  );
});
