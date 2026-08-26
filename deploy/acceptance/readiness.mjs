export function isRunnableScriptVersion(script, expectedHash) {
  return (
    String(script.hash) === expectedHash &&
    script.lock !== null &&
    script.lock_error_logs == null
  );
}
