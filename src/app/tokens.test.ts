// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Reads the tokens from globals.css itself, so the test checks the values the app actually ships.
const css = readFileSync(
  path.resolve(process.cwd(), "src/app/globals.css"),
  "utf8",
);
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(
    ([, name, hex]) => [name, hex],
  ),
) as Record<string, string>;

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string) {
  const fg = tokens[foreground];
  const bg = tokens[background];
  if (!fg || !bg) {
    throw new Error(`Unknown token: ${fg ? background : foreground}`);
  }
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

describe("brand tokens (docs/design-system.md)", () => {
  it("uses the brand values decided for the portal", () => {
    expect(tokens).toMatchObject({
      navy: "#012768",
      royal: "#054cc3",
      blue: "#0d77eb",
      sky: "#159ed5",
      ice: "#e9f3fd",
      sun: "#ffc928",
      canvas: "#f6f8fb",
      surface: "#ffffff",
      ink: "#16181b",
      muted: "#55595f",
      line: "#d9dee6",
      success: "#0e7a4f",
      danger: "#b42318",
    });
  });

  // Every text/background pair the components use. WCAG AA: 4.5:1 for normal text.
  it.each([
    ["ink", "surface"],
    ["ink", "canvas"],
    ["ink", "neutral-soft"],
    ["muted", "surface"],
    ["muted", "canvas"],
    ["navy", "surface"],
    ["navy", "canvas"],
    ["navy", "ice"],
    ["navy", "sun"],
    ["royal", "surface"],
    ["royal", "ice"],
    ["royal", "canvas"],
    ["white", "navy"],
    ["white", "royal"],
    ["white", "danger"],
    ["danger", "surface"],
    ["danger", "danger-soft"],
    ["success", "surface"],
    ["success", "success-soft"],
    ["sky", "navy"],
    ["sun", "navy"],
  ])("%s text on %s meets 4.5:1", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  // Focus ring and other meaningful non-text parts: 3:1 against what they sit on.
  it.each([
    ["royal", "surface"],
    ["royal", "canvas"],
    ["royal", "ice"],
  ])("%s focus ring on %s meets 3:1", (ring, background) => {
    expect(contrast(ring, background)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["white", "sky"],
    ["white", "sun"],
  ])("never puts %s text on %s (fails contrast)", (foreground, background) => {
    expect(contrast(foreground, background)).toBeLessThan(4.5);
  });
});
