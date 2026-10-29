import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins conditional class names", () => {
    expect(cn("px-4", false && "hidden", undefined, "py-2")).toBe("px-4 py-2");
  });

  it("lets a later class override a conflicting earlier one", () => {
    expect(cn("bg-navy px-4", "bg-royal")).toBe("px-4 bg-royal");
  });

  it("keeps a brand font size and a brand text colour together", () => {
    // Without our type scale registered, tailwind-merge would treat text-body as a colour and drop text-ink.
    expect(cn("text-ink", "text-body")).toBe("text-ink text-body");
    expect(cn("text-meta text-muted", "text-table")).toBe(
      "text-muted text-table",
    );
  });
});
