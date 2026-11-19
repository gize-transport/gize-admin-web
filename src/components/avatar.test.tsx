import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteIcon } from "lucide-react";
import { Avatar, IconAvatar, initials } from "./avatar";

describe("initials", () => {
  it.each([
    ["Abebe Admin", "AA"],
    ["Selam", "S"],
    ["mary jane watson", "MJ"],
    ["Abebe Kebede Tesfaye", "AK"],
    ["Kebede (Driver)", "K"],
    ["  Fikru   Hailu  ", "FH"],
    ["አበበ ከበደ", "አከ"],
    ["", ""],
  ])("%j → %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it("keeps a letter with its marks together", () => {
    // "é" written as e + a combining accent.
    expect(initials("élise Bekele")).toBe("ÉB");
  });
});

describe("initials without Intl.Segmenter", () => {
  it("takes each word's first character", async () => {
    const segmenter = Intl.Segmenter;
    vi.resetModules();
    Reflect.deleteProperty(Intl, "Segmenter");
    try {
      const fresh = await import("./avatar");
      expect(fresh.initials("Abebe Admin")).toBe("AA");
      expect(fresh.initials("አበበ ከበደ")).toBe("አከ");
    } finally {
      Object.defineProperty(Intl, "Segmenter", {
        value: segmenter,
        configurable: true,
        writable: true,
      });
    }
  });
});

describe("Avatar", () => {
  it("shows the initials and is hidden from screen readers (the name is beside it)", () => {
    render(<Avatar name="Abebe Admin" />);

    const avatar = screen.getByText("AA");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
  });
});

describe("IconAvatar", () => {
  it("shows the icon in a tile hidden from screen readers", () => {
    const { container } = render(<IconAvatar icon={RouteIcon} />);

    const tile = container.firstElementChild;
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile?.querySelector("svg")).not.toBeNull();
  });
});
