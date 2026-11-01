import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./problem";
import { createQueryClient, shouldRetryQuery } from "./query-client";

function httpError(status: number, headers: Record<string, string> = {}) {
  return ApiError.fromResponse(
    new Response(null, { status, headers }),
    undefined,
  );
}

describe("shouldRetryQuery", () => {
  it("retries network errors and gateway errors up to two times", () => {
    const network = ApiError.network(new TypeError("Failed to fetch"));

    expect(shouldRetryQuery(0, network)).toBe(true);
    expect(shouldRetryQuery(1, network)).toBe(true);
    expect(shouldRetryQuery(2, network)).toBe(false);
    expect(shouldRetryQuery(0, httpError(502))).toBe(true);
    expect(shouldRetryQuery(0, httpError(504))).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422, 429, 500, 503])(
    "never retries a %i on its own",
    (status) => {
      expect(shouldRetryQuery(0, httpError(status))).toBe(false);
    },
  );

  it("never retries an unexpected error", () => {
    expect(shouldRetryQuery(0, new Error("bug"))).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("never retries mutations", () => {
    const client = createQueryClient({ onUnauthenticated: vi.fn() });

    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
    expect(client.getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
  });

  it("signs the user in again when a query gets a 401", async () => {
    const onUnauthenticated = vi.fn();
    const client = createQueryClient({ onUnauthenticated });

    await client
      .fetchQuery({
        queryKey: ["staff-me"],
        queryFn: () => Promise.reject(httpError(401)),
      })
      .catch(() => {});

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("signs the user in again when a mutation gets a 401", async () => {
    const onUnauthenticated = vi.fn();
    const client = createQueryClient({ onUnauthenticated });
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(httpError(401)),
    });

    await mutation.execute(undefined).catch(() => {});

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("leaves other errors to the screen", async () => {
    const onUnauthenticated = vi.fn();
    const client = createQueryClient({ onUnauthenticated });

    await client
      .fetchQuery({
        queryKey: ["areas"],
        queryFn: () => Promise.reject(httpError(403)),
      })
      .catch(() => {});

    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});
