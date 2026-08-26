import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

// This fixed endpoint is exclusively for compose.test.yml's disposable database.
const base = "http://127.0.0.1:18090";
const request = (path, options = {}) =>
  fetch(`${base}${path}`, {
    ...options,
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
let ready = false;
let lastProbe = "not attempted";
for (let attempt = 0; attempt < 90; attempt++) {
  try {
    const response = await request("/api/version");
    lastProbe = `HTTP ${response.status}`;
    if (response.status === 200) {
      ready = true;
      break;
    }
  } catch (error) {
    lastProbe = error.cause?.code || error.name;
  }
  await delay(2000);
}
assert.ok(ready, `Candidate failed to start; last version probe: ${lastProbe}`);
assert.equal((await request("/")).status, 200, "Embedded frontend missing");
for (const headers of [
  {},
  { Authorization: "Bearer deliberately-invalid-token" },
]) {
  const response = await request("/api/users/whoami", { headers });
  assert.ok(
    [401, 403].includes(response.status),
    "Unauthenticated access was not rejected",
  );
}
const login = (password) =>
  request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@windmill.dev", password }),
  });
const badLogin = await login("deliberately-wrong-password");
assert.ok(
  [400, 401, 403].includes(badLogin.status),
  "Wrong password was not rejected",
);
const goodLogin = await login("changeme");
assert.equal(goodLogin.status, 200, "Isolated default account cannot log in");
const token = (await goodLogin.text()).trim();
assert.ok(
  token.length > 16 && token !== "no_auth",
  "Expected a real session token",
);
const authed = await request("/api/users/whoami", {
  headers: { Authorization: `Bearer ${token}` },
});
assert.equal(authed.status, 200, "Authenticated identity lookup failed");
assert.equal((await authed.json()).email, "admin@windmill.dev");
console.log(
  "PASS: frontend, anonymous denial, invalid-token denial, wrong-password denial, real login",
);
