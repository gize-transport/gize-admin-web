// @ts-check
// Test accounts that exist only in the e2e stand-ins (fake-services.mjs). They are not real
// people or real credentials, and the stand-ins never run outside e2e.

/**
 * @typedef {import("../../src/lib/api/schema").components["schemas"]["StaffMe"]} StaffMe
 * @typedef {{
 *   email: string,
 *   password: string,
 *   staff: StaffMe | "forbidden",
 * }} TestUser `staff`: what `GET /v1/staff/me` answers – the staff member, or 403.
 */

export const TEST_PASSWORD = "e2e-only-password";

export const testUsers =
  /** @type {const} @satisfies {Record<string, TestUser>} */ ({
    admin: {
      email: "admin@gize.test",
      password: TEST_PASSWORD,
      staff: {
        id: "00000000-0000-4000-8000-000000000001",
        full_name: "Abebe Admin",
        email: "admin@gize.test",
        role: "admin",
      },
    },
    staff: {
      email: "staff@gize.test",
      password: TEST_PASSWORD,
      staff: {
        id: "00000000-0000-4000-8000-000000000002",
        full_name: "Selam Staff",
        email: "staff@gize.test",
        role: "staff",
      },
    },
    /**
     * Staff who set their password from an email link (GZW-012): one per Playwright project,
     * since the tests change these passwords.
     */
    resetDesktop: {
      email: "reset.desktop@gize.test",
      password: TEST_PASSWORD,
      staff: {
        id: "00000000-0000-4000-8000-000000000021",
        full_name: "Rahel Reset",
        email: "reset.desktop@gize.test",
        role: "staff",
      },
    },
    resetMobile: {
      email: "reset.mobile@gize.test",
      password: TEST_PASSWORD,
      staff: {
        id: "00000000-0000-4000-8000-000000000022",
        full_name: "Robel Reset",
        email: "reset.mobile@gize.test",
        role: "staff",
      },
    },
    /** Signs in to Supabase, but the API answers 403 (deactivated or never invited). */
    outsider: {
      email: "outsider@gize.test",
      password: TEST_PASSWORD,
      staff: "forbidden",
    },
  });

/** Ports of the stand-ins; the e2e build points NEXT_PUBLIC_* at them (playwright.config.ts, ci.yml). */
export const FAKE_SUPABASE_PORT = 54399;
export const FAKE_API_PORT = 8199;
