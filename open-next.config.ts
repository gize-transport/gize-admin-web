import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page renders per request (the Content Security Policy's nonce, next.config.ts), so
// there is no Next.js cache to keep: no incremental cache or queue.
export default defineCloudflareConfig();
