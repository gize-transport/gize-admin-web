// The API's Ethiopian mobile rule: separators people type, an optional +251 / 00251 / 251
// (maybe with the trunk 0) or 0, then 9 or 7 and eight digits.
const PHONE_SEPARATORS = /[  \t().-]/g;
const MOBILE = /^(?:(?:\+|00)?2510?|0)?([79][0-9]{8})$/;

/** The longest phone the API accepts as typed (`contact_phone`, before it's normalised). */
export const PHONE_TYPED_MAX = 20;

/** The number as the API stores it (`+2519…`/`+2517…`), or null if it isn't a mobile. */
export function mobileE164(typed: string): string | null {
  const match = MOBILE.exec(typed.trim().replace(PHONE_SEPARATORS, ""));
  return match ? `+251${match[1]}` : null;
}
