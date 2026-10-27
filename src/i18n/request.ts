import { getRequestConfig } from "next-intl/server";
import { defaultLocale, timeZone } from "./config";

// English only for now; the locale is not part of the URL. Amharic will add messages/am.json and a locale source.
export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: (await import(`../../messages/${defaultLocale}.json`)).default,
  timeZone,
}));
