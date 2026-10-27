export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// API times are UTC; the portal always displays them in Addis Ababa time.
export const timeZone = "Africa/Addis_Ababa";
