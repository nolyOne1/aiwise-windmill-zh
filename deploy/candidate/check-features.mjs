import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function checkFeatures(metadata) {
  const nodes = new Map(
    metadata.resolve?.nodes?.map((node) => [node.id, node]),
  );
  const packages = new Map(metadata.packages?.map((pkg) => [pkg.id, pkg.name]));
  const root = metadata.resolve?.root;
  if (!root || packages.get(root) !== "windmill" || !nodes.has(root)) {
    throw new Error(
      "Missing resolved windmill root; refusing an unaudited build",
    );
  }
  const visited = new Set();
  const pending = [root];
  while (pending.length) {
    const id = pending.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodes.get(id);
    if (!node) throw new Error("Incomplete dependency feature graph");
    const name = packages.get(id);
    if (name === "windmill" || name?.startsWith("windmill-")) {
      for (const feature of node.features) {
        if (["no_auth", "private", "enterprise"].includes(feature)) {
          throw new Error(`Forbidden candidate feature: ${name}/${feature}`);
        }
      }
    }
    for (const dep of node.deps) {
      if (dep.dep_kinds.some(({ kind }) => kind !== "dev"))
        pending.push(dep.pkg);
    }
  }
  if (!visited.size) throw new Error("Empty feature graph");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkFeatures(JSON.parse(readFileSync(process.argv[2], "utf8")));
  console.log(
    "Resolved candidate features contain no auth bypass or private/enterprise code",
  );
}
