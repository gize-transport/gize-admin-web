import { useCallback, useState } from "react";

/**
 * One `Idempotency-Key` per user action (api-contract.md): keep `key` for every retry of the
 * same action, so the API never applies it twice, and call `renew()` once it has succeeded or
 * the user starts a different one (e.g. a dialog opens again).
 */
export function useIdempotencyKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const renew = useCallback(() => setKey(crypto.randomUUID()), []);
  return { key, renew };
}
