import { useQuery } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/problem";
import { QueryProvider, signInHref } from "./query-provider";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/areas" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
}));
const replace = navigation.replace;

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

describe("signInHref", () => {
  it("keeps the current path and filters as next", () => {
    expect(signInHref({ pathname: "/routes", search: "?status=forming" })).toBe(
      "/sign-in?next=%2Froutes%3Fstatus%3Dforming",
    );
  });

  it("treats only /sign-in and its subpaths as the sign-in page", () => {
    expect(signInHref({ pathname: "/sign-inx", search: "" })).toBe(
      "/sign-in?next=%2Fsign-inx",
    );
  });

  it("returns null on the sign-in page itself", () => {
    expect(
      signInHref({ pathname: "/sign-in", search: "?next=%2F" }),
    ).toBeNull();
  });
});

describe("QueryProvider", () => {
  it("goes to sign-in once when several queries get a 401", async () => {
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
