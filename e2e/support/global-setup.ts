import { rmSync } from "node:fs";
import { SCREENSHOT_DIR } from "./screens";

// Start every run with an empty screenshots folder, so files from renamed or removed screens can't linger.
export default function globalSetup() {
  rmSync(SCREENSHOT_DIR, { recursive: true, force: true });
}
