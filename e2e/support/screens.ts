import path from "node:path";

/** Every screen shown in PR screenshots. Each ticket that adds or changes a screen adds it here. */
export const screens = [{ name: "home", path: "/" }] as const;

export const SCREENSHOT_DIR = "screenshots";

/** e.g. screenshots/home-1440.png – the same names the pr-screenshots branch uses. */
export function screenshotPath(name: string, width: number) {
  return path.join(SCREENSHOT_DIR, `${name}-${width}.png`);
}
