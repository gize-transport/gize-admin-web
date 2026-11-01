import { useQuery } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/problem";
import { QueryProvider } from "./query-provider";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/areas" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
}));
const replace = navigation.replace;
const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth }),
}));

function FailingQuery({ id }: { id: string }) {
  useQuery({
    queryKey: ["fails", id],
    queryFn: () =>
      Promise.reject(
        ApiError.fromResponse(new Response(null, { status: 401 }), undefined),
      ),
  });
  return null;
}

describe("QueryProvider", () => {
  it("signs this browser out of Supabase before going to sign-in", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    replace.mockClear();
    window.history.replaceState(null, "", "/areas");
    navigation.pathname = "/areas";

    render(
      <QueryProvider>
        <FailingQuery id="signout" />
      </QueryProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      replace.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("goes to sign-in once when several queries get a 401", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    replace.mockClear();
    window.history.replaceState(null, "", "/areas?q=bo");

    render(
      <QueryProvider>
        <FailingQuery id="a" />
        <FailingQuery id="b" />
      </QueryProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/sign-in?next=%2Fareas%3Fq%3Dbo");
  });

  it("redirects again after the user is back on a portal page", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    replace.mockClear();
    window.history.replaceState(null, "", "/areas");
    navigation.pathname = "/areas";
    const { rerender } = render(
      <QueryProvider>
        <FailingQuery id="first" />
      </QueryProvider>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));

    // Signed in again: the router is back on a portal page.
    navigation.pathname = "/sign-in";
    rerender(
      <QueryProvider>
        <FailingQuery id="first" />
      </QueryProvider>,
    );
    navigation.pathname = "/routes";
    window.history.replaceState(null, "", "/routes");
    rerender(
      <QueryProvider>
        <FailingQuery id="second" />
      </QueryProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(2));
    expect(replace).toHaveBeenLastCalledWith("/sign-in?next=%2Froutes");
  });
});
