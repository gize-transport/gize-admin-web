import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

/** Starts the MSW server for this test file; any request without a handler fails the test. */
export function useMswServer() {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
