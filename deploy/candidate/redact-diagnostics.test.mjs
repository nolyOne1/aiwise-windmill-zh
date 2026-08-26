import test from "node:test";
import assert from "node:assert/strict";
import { redactDiagnostics } from "./redact-diagnostics.mjs";

test("redacts test passwords, database credentials and bearer tokens", () => {
  assert.equal(
    redactDiagnostics(
      "password=test-secret postgres://postgres:other-secret@db:5432/windmill Authorization: Bearer session-token",
      ["test-secret"],
    ),
    "password=[REDACTED] postgres://[REDACTED]@db:5432/windmill Authorization: Bearer [REDACTED]",
  );
});

test("retains the startup error and exit state without an available password", () => {
  assert.equal(
    redactDiagnostics("Exited (1): migration failed", [undefined, ""]),
    "Exited (1): migration failed",
  );
});
