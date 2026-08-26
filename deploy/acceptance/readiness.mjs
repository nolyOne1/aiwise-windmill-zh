export function isRunnableScriptVersion(script, expectedHash) {
  return (
    String(script.hash) === expectedHash &&
    typeof script.lock === "string" &&
    script.lock_error_logs == null
  );
}
