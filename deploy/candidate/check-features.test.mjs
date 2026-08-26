import test from "node:test";
import assert from "node:assert/strict";
import { checkFeatures } from "./check-features.mjs";

function fixture(features = []) {
  return {
    packages: [
      { id: "root", name: "windmill" },
      { id: "auth", name: "windmill-api-auth" },
    ],
    resolve: {
      root: "root",
      nodes: [
        {
          id: "root",
          features: ["oss_core"],
          deps: [{ pkg: "auth", dep_kinds: [{ kind: null }] }],
        },
        { id: "auth", features, deps: [] },
      ],
    },
  };
}

test("accepts authenticated public source features", () => {
  assert.doesNotThrow(() => checkFeatures(fixture()));
});

for (const feature of ["no_auth", "private", "enterprise"]) {
  test(`rejects transitive ${feature}`, () => {
    assert.throws(
      () => checkFeatures(fixture([feature])),
      /Forbidden candidate feature/,
    );
  });
}

test("fails closed when Cargo resolution is missing", () => {
  assert.throws(() => checkFeatures({}), /Missing resolved/);
});
