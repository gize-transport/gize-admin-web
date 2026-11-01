import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIdempotencyKey } from "./idempotency";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("useIdempotencyKey", () => {
  it("keeps one key across renders, so a retry reuses it", () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const first = result.current.key;

    rerender();

    expect(first).toMatch(uuid);
    expect(result.current.key).toBe(first);
  });

  it("starts a new key for the next action", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.key;

    act(() => result.current.renew());

    expect(result.current.key).toMatch(uuid);
    expect(result.current.key).not.toBe(first);
  });
});
