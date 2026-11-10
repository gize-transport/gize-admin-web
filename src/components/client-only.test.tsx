import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientOnly } from "./client-only";

describe("ClientOnly", () => {
  it("shows the fallback on the server", () => {
    const html = renderToString(
      <ClientOnly fallback={<p>Loading</p>}>
        <p>Screen</p>
      </ClientOnly>,
    );
    expect(html).toContain("Loading");
    expect(html).not.toContain("Screen");
  });

  it("shows the children in the browser", () => {
    render(
      <ClientOnly fallback={<p>Loading</p>}>
        <p>Screen</p>
      </ClientOnly>,
    );
    expect(screen.getByText("Screen")).toBeVisible();
  });
});
