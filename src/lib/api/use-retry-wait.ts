"use client";

import { useEffect, useState } from "react";
import { ApiError } from "./problem";

/**
 * True while a 429's `Retry-After` hasn't passed yet, so the action that failed (Save, Delete)
 * stays disabled for as long as ProblemAlert counts down. Each new error starts its own wait.
 */
export function useRetryWait(error: unknown): boolean {
  const seconds = error instanceof ApiError ? error.retryAfterSeconds : null;
  const [state, setState] = useState({ error, waiting: Boolean(seconds) });
  if (state.error !== error) {
    setState({ error, waiting: Boolean(seconds) });
  }

  useEffect(() => {
    if (!seconds) return;
    // A throttled background timer can only fire late, never early: the wait is never cut short.
    const timer = setTimeout(
      () =>
        setState((current) =>
          current.error === error ? { error, waiting: false } : current,
        ),
      seconds * 1000,
    );
    return () => clearTimeout(timer);
  }, [error, seconds]);

  return state.waiting;
}
