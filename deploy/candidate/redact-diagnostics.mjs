import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export function redactDiagnostics(text, secrets = []) {
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s/]+@/gi, "postgres://[REDACTED]@")
    .replace(/(Bearer\s+)\S+/gi, "$1[REDACTED]");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    console.log(redactDiagnostics(line, [process.env.CANDIDATE_DB_PASSWORD]));
  }
}
